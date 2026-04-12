from __future__ import annotations

import argparse
import asyncio
import os
from datetime import datetime, timedelta, timezone
from typing import Any

from diagnostics.telemetry import (
    MCPEvent,
    MCPEventQuery,
    MCPEventStore,
    create_event_store_from_env,
)
from diagnostics.reports import (
    build_status_report,
    format_status_report,
    build_failures_report,
    format_failures_report,
    build_latency_report,
    format_latency_report,
    build_usage_report,
    format_usage_report,
    build_reliability_report,
    format_reliability_report,
    build_session_report,
    format_session_report,
    format_session_not_found,
    build_anomalies_report,
    format_anomalies_report,
    build_trace_report,
    format_trace_report,
    format_trace_not_found,
    _percentile,
)
from diagnostics.health import (
    HealthCheckResult,
    check_required_env,
    check_supabase_connectivity,
    check_supabase_schema,
    check_ghl_probe,
    format_health_report,
)
from diagnostics.inspect import (
    _load_local_tools,
    _load_remote_tools,
    _tool_to_dict,
    _categorize_tools,
    build_inspect_report,
    format_inspect_report,
    build_inspector_command,
    format_inspector_launch,
    run_inspector,
)


class CLICommandError(RuntimeError):
    def __init__(self, output: str):
        super().__init__(output)
        self.output = output


async def _load_events(
    store: MCPEventStore,
    *,
    days: int | None = None,
    until: datetime | None = None,
    limit: int,
    actor: str | None = None,
    integration: str | None = None,
    tool_name: str | None = None,
    success: bool | None = None,
    request_id: str | None = None,
) -> list[MCPEvent]:
    since = None
    if days is not None:
        since = datetime.now(timezone.utc) - timedelta(days=days)
    query = MCPEventQuery(
        request_id=request_id,
        since=since,
        until=until,
        actor=actor,
        integration_category=integration,
        tool_name=tool_name,
        success=success,
        limit=limit,
    )
    return await store.fetch_events(query)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="jimmy-diag", description="Jimmy diagnostics CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_common_arguments(command_parser: argparse.ArgumentParser, *, default_days: int, default_limit: int = 1000) -> None:
        command_parser.add_argument("--days", type=int, default=default_days, help="Lookback window in days")
        command_parser.add_argument("--limit", type=int, default=default_limit, help="Max rows to read")
        command_parser.add_argument("--actor", type=str, default=None, help="Filter by actor")
        command_parser.add_argument("--integration", type=str, default=None, help="Filter by integration category")
        command_parser.add_argument("--tool", type=str, default=None, help="Filter by tool")

    health_parser = subparsers.add_parser("health", help="Run live operator health checks")
    health_parser.add_argument("--integration", type=str, default=None, help="Reserved for future multi-integration health checks")

    status_parser = subparsers.add_parser("status", help="Show service health and recent activity")
    add_common_arguments(status_parser, default_days=1, default_limit=500)

    failures_parser = subparsers.add_parser("failures", help="Show recent failures")
    add_common_arguments(failures_parser, default_days=7, default_limit=1000)
    failures_parser.add_argument("--recent-limit", type=int, default=10, help="Max failures to print")

    latency_parser = subparsers.add_parser("latency", help="Show latency summary")
    add_common_arguments(latency_parser, default_days=7, default_limit=1000)

    usage_parser = subparsers.add_parser("usage", help="Show usage summary")
    add_common_arguments(usage_parser, default_days=7, default_limit=1000)

    trace_parser = subparsers.add_parser("trace", help="Trace a single request by request_id")
    trace_parser.add_argument("request_id", type=str, help="Exact request_id to inspect")
    trace_parser.add_argument("--integration", type=str, default=None, help="Filter by integration category")

    reliability_parser = subparsers.add_parser("reliability", help="Per-tool success rates and error breakdown")
    add_common_arguments(reliability_parser, default_days=7, default_limit=1000)

    session_parser = subparsers.add_parser("session", help="Replay all MCP events in a session")
    session_parser.add_argument("session_id", type=str, help="Session ID to inspect")

    anomalies_parser = subparsers.add_parser("anomalies", help="Detect spikes vs baseline window")
    anomalies_parser.add_argument("--current-days", type=int, default=1, help="Current window in days (default: 1)")
    anomalies_parser.add_argument("--baseline-days", type=int, default=7, help="Baseline window in days (default: 7)")
    anomalies_parser.add_argument("--threshold", type=float, default=2.0, help="Alert when metric exceeds Nx baseline (default: 2.0)")
    anomalies_parser.add_argument("--limit", type=int, default=2000, help="Max rows to read per window")
    anomalies_parser.add_argument("--actor", type=str, default=None, help="Filter by actor")
    anomalies_parser.add_argument("--integration", type=str, default=None, help="Filter by integration category")
    anomalies_parser.add_argument("--tool", type=str, default=None, help="Filter by tool")

    inspect_parser = subparsers.add_parser("inspect", help="Inspect MCP server tools and schemas")
    inspect_parser.add_argument("--remote", type=str, default=None, metavar="URL", help="Connect to remote MCP server URL instead of local")
    inspect_parser.add_argument("--token", type=str, default=None, help="Auth token for remote server (or set MCP_AUTH_TOKEN)")
    inspect_parser.add_argument("--schema", action="store_true", default=False, help="Show full parameter details for each tool")
    inspect_parser.add_argument("--tool", type=str, default=None, help="Filter tools by name substring")

    inspector_parser = subparsers.add_parser("inspector", help="Launch official MCP Inspector (visual debugger)")
    inspector_parser.add_argument("--cli", action="store_true", default=False, help="Run in headless CLI mode instead of browser UI")
    inspector_parser.add_argument("--remote", type=str, default=None, metavar="URL", help="Connect to remote HTTP MCP server URL")
    inspector_parser.add_argument("--token", type=str, default=None, help="Auth token for remote server (or set MCP_AUTH_TOKEN)")
    inspector_parser.add_argument("--port", type=int, default=None, help="Client UI port (default: 6274)")
    inspector_parser.add_argument("--server-port", type=int, default=None, help="Proxy server port (default: 6277)")

    return parser


async def run_command(args: argparse.Namespace, *, store: MCPEventStore | None = None) -> str:
    resolved_store = store or create_event_store_from_env()
    store_configured = getattr(resolved_store, "enabled", True)

    if args.command == "inspect":
        if args.remote:
            token = args.token or os.getenv("MCP_AUTH_TOKEN", "").strip()
            if not token:
                raise RuntimeError("Auth token required for remote inspect. Use --token or set MCP_AUTH_TOKEN.")
            tools = await _load_remote_tools(args.remote, token)
            mode = f"remote ({args.remote})"
        else:
            tools = await _load_local_tools()
            mode = "local"
        report = build_inspect_report(tools, mode=mode, show_schema=args.schema, tool_filter=args.tool)
        return format_inspect_report(report)

    if args.command == "health":
        results = [
            await check_required_env(),
            await check_supabase_connectivity(resolved_store),
            await check_supabase_schema(resolved_store),
            await check_ghl_probe(),
        ]
        output = format_health_report(results)
        if not all(result.healthy for result in results):
            raise CLICommandError(output)
        return output

    if args.command == "trace":
        if not store_configured:
            raise RuntimeError("Supabase event store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        events = await _load_events(
            resolved_store,
            limit=1,
            integration=args.integration,
            request_id=args.request_id,
        )
        if not events:
            raise CLICommandError(format_trace_not_found(args.request_id, integration=args.integration))
        return format_trace_report(build_trace_report(events[0]))

    if args.command == "session":
        if not store_configured:
            raise RuntimeError("Supabase event store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        query = MCPEventQuery(session_id=args.session_id, limit=500)
        session_events = await resolved_store.fetch_events(query)
        if not session_events:
            raise CLICommandError(format_session_not_found(args.session_id))
        report = build_session_report(session_events, session_id=args.session_id)
        return format_session_report(report)

    if args.command == "anomalies":
        if not store_configured:
            raise RuntimeError("Supabase event store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")
        current_events = await _load_events(
            resolved_store,
            days=args.current_days,
            limit=args.limit,
            actor=args.actor,
            integration=args.integration,
            tool_name=args.tool,
        )
        baseline_cutoff = datetime.now(timezone.utc) - timedelta(days=args.current_days)
        baseline_events = await _load_events(
            resolved_store,
            days=args.baseline_days,
            until=baseline_cutoff,
            limit=args.limit,
            actor=args.actor,
            integration=args.integration,
            tool_name=args.tool,
        )
        baseline_actual_days = max(args.baseline_days - args.current_days, 1)
        report = build_anomalies_report(
            current_events,
            baseline_events,
            current_days=args.current_days,
            baseline_days=baseline_actual_days,
            threshold=args.threshold,
            integration=args.integration,
        )
        return format_anomalies_report(report)

    events = await _load_events(
        resolved_store,
        days=args.days,
        limit=args.limit,
        actor=args.actor,
        integration=args.integration,
        tool_name=args.tool,
    )

    if args.command == "status":
        report = build_status_report(
            events,
            store_configured=store_configured,
            window_days=args.days,
            integration=args.integration,
        )
        return format_status_report(report)

    if not store_configured:
        raise RuntimeError("Supabase event store is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

    if args.command == "failures":
        report = build_failures_report(events, limit=args.recent_limit, integration=args.integration)
        return format_failures_report(report)

    if args.command == "latency":
        report = build_latency_report(events, integration=args.integration)
        return format_latency_report(report)

    if args.command == "usage":
        report = build_usage_report(events, integration=args.integration)
        return format_usage_report(report)

    if args.command == "reliability":
        report = build_reliability_report(events, integration=args.integration)
        return format_reliability_report(report)

    raise ValueError(f"Unknown command: {args.command}")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "inspector":
        result = build_inspector_command(
            cli_mode=args.cli,
            remote_url=args.remote,
            auth_token=args.token,
            port=args.port,
            server_port=args.server_port,
        )
        return run_inspector(result)

    try:
        output = asyncio.run(run_command(args))
    except CLICommandError as exc:
        print(exc.output)
        return 1
    except RuntimeError as exc:
        parser.exit(1, f"error: {exc}\n")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
