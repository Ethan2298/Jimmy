from __future__ import annotations

import argparse
import asyncio
import json
import os
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from statistics import mean
from typing import Any

import httpx

from mcp_servers.ghl.client import GHLAPIError, GHLClient
from diagnostics.telemetry import (
    MCPEvent,
    MCPEventQuery,
    MCPEventStore,
    SupabaseEventStore,
    create_event_store_from_env,
)

REQUIRED_HEALTH_ENV_VARS = (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GHL_API_KEY",
    "GHL_LOCATION_ID",
)
REQUIRED_SCHEMA_COLUMNS = (
    "request_id",
    "occurred_at",
    "actor",
    "session_id",
    "integration_category",
    "tool_name",
    "duration_ms",
    "success",
    "error_code",
    "scope_required",
    "upstream_status",
    "payload_summary",
)


class CLICommandError(RuntimeError):
    def __init__(self, output: str):
        super().__init__(output)
        self.output = output


@dataclass(slots=True)
class HealthCheckResult:
    name: str
    healthy: bool
    detail: str


def _format_dt(value: datetime | None) -> str:
    if value is None:
        return "n/a"
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")


def _percentile(values: list[int], pct: float) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    rank = int((len(ordered) * pct) + 0.999999)
    index = min(max(rank - 1, 0), len(ordered) - 1)
    return ordered[index]


def _top_rows(counter: Counter[str], limit: int = 5) -> list[tuple[str, int]]:
    return sorted(counter.items(), key=lambda item: (-item[1], item[0]))[:limit]


def _tool_stats(events: list[MCPEvent]) -> dict[str, dict[str, Any]]:
    buckets: dict[str, list[int]] = defaultdict(list)
    for event in events:
        buckets[event.tool_name].append(event.duration_ms)

    stats: dict[str, dict[str, Any]] = {}
    for tool_name, durations in buckets.items():
        stats[tool_name] = {
            "count": len(durations),
            "avg_ms": int(round(mean(durations))) if durations else 0,
            "p95_ms": _percentile(durations, 0.95),
            "max_ms": max(durations) if durations else 0,
        }
    return dict(sorted(stats.items(), key=lambda item: (-item[1]["count"], item[0])))


def _integration_stats(events: list[MCPEvent]) -> dict[str, dict[str, Any]]:
    buckets: dict[str, list[int]] = defaultdict(list)
    for event in events:
        buckets[event.integration_category].append(event.duration_ms)

    stats: dict[str, dict[str, Any]] = {}
    for category, durations in buckets.items():
        stats[category] = {
            "count": len(durations),
            "avg_ms": int(round(mean(durations))) if durations else 0,
            "p95_ms": _percentile(durations, 0.95),
            "max_ms": max(durations) if durations else 0,
        }
    return dict(sorted(stats.items(), key=lambda item: (-item[1]["count"], item[0])))


def build_status_report(events: list[MCPEvent], *, store_configured: bool, window_days: int, integration: str | None = None) -> dict[str, Any]:
    failures = [event for event in events if not event.success]
    latency_values = [event.duration_ms for event in events]
    tool_counts = Counter(event.tool_name for event in events)
    actor_counts = Counter(event.actor for event in events)
    integration_counts = Counter(event.integration_category for event in events)
    last_event_at = max((event.timestamp for event in events), default=None)
    return {
        "store_configured": store_configured,
        "window_days": window_days,
        "integration_filter": integration,
        "event_count": len(events),
        "failure_count": len(failures),
        "last_event_at": last_event_at,
        "p95_ms": _percentile(latency_values, 0.95),
        "top_tool": _top_rows(tool_counts, 1)[0] if tool_counts else None,
        "top_actor": _top_rows(actor_counts, 1)[0] if actor_counts else None,
        "top_integration": _top_rows(integration_counts, 1)[0] if integration_counts else None,
    }


def format_status_report(report: dict[str, Any]) -> str:
    lines = [
        "Jimmy status",
        f"- event store: {'configured' if report['store_configured'] else 'not configured'}",
        f"- window: {report['window_days']}d",
    ]
    if report["integration_filter"]:
        lines.append(f"- integration filter: {report['integration_filter']}")
    lines.extend(
        [
            f"- events: {report['event_count']}",
            f"- failures: {report['failure_count']}",
            f"- last event: {_format_dt(report['last_event_at'])}",
            f"- p95 latency: {report['p95_ms']} ms",
        ]
    )
    if report["top_tool"]:
        tool, count = report["top_tool"]
        lines.append(f"- top tool: {tool} ({count})")
    if report["top_actor"]:
        actor, count = report["top_actor"]
        lines.append(f"- top actor: {actor} ({count})")
    if report["top_integration"]:
        integration, count = report["top_integration"]
        lines.append(f"- top integration: {integration} ({count})")
    return "\n".join(lines)


def build_failures_report(events: list[MCPEvent], *, limit: int, integration: str | None = None) -> dict[str, Any]:
    failures = [event for event in events if not event.success]
    failure_codes = Counter(event.error_code or "unknown" for event in failures)
    failure_integrations = Counter(event.integration_category for event in failures)
    recent_failures = failures[:limit]
    return {
        "integration_filter": integration,
        "failure_count": len(failures),
        "failure_codes": failure_codes,
        "failure_integrations": failure_integrations,
        "recent_failures": recent_failures,
    }


def format_failures_report(report: dict[str, Any]) -> str:
    lines = [
        "Jimmy failures",
        f"- total failures: {report['failure_count']}",
    ]
    if report["integration_filter"]:
        lines.append(f"- integration filter: {report['integration_filter']}")
    if report["failure_codes"]:
        lines.append("- failure codes:")
        for code, count in _top_rows(report["failure_codes"], limit=10):
            lines.append(f"  - {code}: {count}")
    if report["failure_integrations"]:
        lines.append("- failure integrations:")
        for integration, count in _top_rows(report["failure_integrations"], limit=10):
            lines.append(f"  - {integration}: {count}")
    if report["recent_failures"]:
        lines.append("- recent failures:")
        for event in report["recent_failures"]:
            lines.append(
                f"  - {_format_dt(event.timestamp)} integration={event.integration_category} {event.tool_name} {event.error_code or 'unknown'} "
                f"status={event.upstream_status or 'n/a'} scope={event.scope_required or 'n/a'} "
                f"actor={event.actor} duration={event.duration_ms}ms request_id={event.request_id}"
            )
    return "\n".join(lines)


def build_latency_report(events: list[MCPEvent], *, integration: str | None = None) -> dict[str, Any]:
    stats = _tool_stats(events)
    integration_stats = _integration_stats(events)
    return {
        "integration_filter": integration,
        "event_count": len(events),
        "tool_stats": stats,
        "integration_stats": integration_stats,
        "overall_avg_ms": int(round(mean([event.duration_ms for event in events]))) if events else 0,
        "overall_p95_ms": _percentile([event.duration_ms for event in events], 0.95),
    }


def format_latency_report(report: dict[str, Any]) -> str:
    lines = [
        "Jimmy latency",
        f"- events: {report['event_count']}",
    ]
    if report["integration_filter"]:
        lines.append(f"- integration filter: {report['integration_filter']}")
    lines.extend(
        [
            f"- overall avg: {report['overall_avg_ms']} ms",
            f"- overall p95: {report['overall_p95_ms']} ms",
        ]
    )
    if report["tool_stats"]:
        lines.append("tool                     count   avg   p95   max")
        for tool_name, stats in report["tool_stats"].items():
            lines.append(
                f"{tool_name:<24} {stats['count']:>5} {stats['avg_ms']:>5} {stats['p95_ms']:>5} {stats['max_ms']:>5}"
            )
    if report["integration_stats"]:
        lines.append("integration              count   avg   p95   max")
        for integration, stats in report["integration_stats"].items():
            lines.append(
                f"{integration:<24} {stats['count']:>5} {stats['avg_ms']:>5} {stats['p95_ms']:>5} {stats['max_ms']:>5}"
            )
    return "\n".join(lines)


def build_usage_report(events: list[MCPEvent], *, integration: str | None = None) -> dict[str, Any]:
    tool_counts = Counter(event.tool_name for event in events)
    actor_counts = Counter(event.actor for event in events)
    integration_counts = Counter(event.integration_category for event in events)
    successful = sum(1 for event in events if event.success)
    return {
        "integration_filter": integration,
        "event_count": len(events),
        "successful_count": successful,
        "failure_count": len(events) - successful,
        "tool_counts": tool_counts,
        "actor_counts": actor_counts,
        "integration_counts": integration_counts,
    }


def format_usage_report(report: dict[str, Any]) -> str:
    lines = [
        "Jimmy usage",
        f"- events: {report['event_count']}",
    ]
    if report["integration_filter"]:
        lines.append(f"- integration filter: {report['integration_filter']}")
    lines.extend(
        [
            f"- successful: {report['successful_count']}",
            f"- failed: {report['failure_count']}",
        ]
    )
    if report["tool_counts"]:
        lines.append("- top tools:")
        for tool, count in _top_rows(report["tool_counts"], limit=10):
            lines.append(f"  - {tool}: {count}")
    if report["actor_counts"]:
        lines.append("- top actors:")
        for actor, count in _top_rows(report["actor_counts"], limit=10):
            lines.append(f"  - {actor}: {count}")
    if report["integration_counts"]:
        lines.append("- top integrations:")
        for integration, count in _top_rows(report["integration_counts"], limit=10):
            lines.append(f"  - {integration}: {count}")
    return "\n".join(lines)


def build_reliability_report(events: list[MCPEvent], *, integration: str | None = None) -> dict[str, Any]:
    tool_buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "success": 0, "failure": 0})
    error_by_tool: dict[str, Counter[str]] = defaultdict(Counter)
    for event in events:
        bucket = tool_buckets[event.tool_name]
        bucket["total"] += 1
        if event.success:
            bucket["success"] += 1
        else:
            bucket["failure"] += 1
            error_by_tool[event.tool_name][event.error_code or "unknown"] += 1

    tool_reliability: dict[str, dict[str, Any]] = {}
    for tool_name, counts in tool_buckets.items():
        rate = (counts["success"] / counts["total"] * 100) if counts["total"] else 0.0
        tool_reliability[tool_name] = {
            "total": counts["total"],
            "success": counts["success"],
            "failure": counts["failure"],
            "success_rate": round(rate, 1),
            "top_errors": _top_rows(error_by_tool.get(tool_name, Counter()), limit=3),
        }

    sorted_tools = dict(sorted(tool_reliability.items(), key=lambda item: (item[1]["success_rate"], -item[1]["total"])))

    total = len(events)
    total_success = sum(1 for e in events if e.success)
    overall_rate = round(total_success / total * 100, 1) if total else 0.0
    return {
        "integration_filter": integration,
        "event_count": total,
        "overall_success_rate": overall_rate,
        "tool_reliability": sorted_tools,
    }


def format_reliability_report(report: dict[str, Any]) -> str:
    lines = [
        "Jimmy reliability",
        f"- events: {report['event_count']}",
        f"- overall success rate: {report['overall_success_rate']}%",
    ]
    if report["integration_filter"]:
        lines.append(f"- integration filter: {report['integration_filter']}")
    if report["tool_reliability"]:
        lines.append("tool                     total   ok  fail  rate%")
        for tool_name, stats in report["tool_reliability"].items():
            lines.append(
                f"{tool_name:<24} {stats['total']:>5} {stats['success']:>4} {stats['failure']:>5} {stats['success_rate']:>5}"
            )
            for error_code, count in stats["top_errors"]:
                lines.append(f"  {error_code}: {count}")
    return "\n".join(lines)


def build_session_report(events: list[MCPEvent], *, session_id: str) -> dict[str, Any]:
    sorted_events = sorted(events, key=lambda e: e.timestamp)
    total_duration = sum(e.duration_ms for e in sorted_events)
    success_count = sum(1 for e in sorted_events if e.success)
    tool_sequence = [e.tool_name for e in sorted_events]
    actors = list({e.actor for e in sorted_events})
    integrations = list({e.integration_category for e in sorted_events})
    first_ts = sorted_events[0].timestamp if sorted_events else None
    last_ts = sorted_events[-1].timestamp if sorted_events else None
    return {
        "session_id": session_id,
        "event_count": len(sorted_events),
        "success_count": success_count,
        "failure_count": len(sorted_events) - success_count,
        "total_tool_duration_ms": total_duration,
        "first_event": first_ts,
        "last_event": last_ts,
        "actors": actors,
        "integrations": integrations,
        "tool_sequence": tool_sequence,
        "events": sorted_events,
    }


def format_session_report(report: dict[str, Any]) -> str:
    lines = [
        "Jimmy session",
        f"- session_id: {report['session_id']}",
        f"- events: {report['event_count']}",
        f"- success: {report['success_count']}  failures: {report['failure_count']}",
        f"- total tool time: {report['total_tool_duration_ms']} ms",
        f"- first event: {_format_dt(report['first_event'])}",
        f"- last event: {_format_dt(report['last_event'])}",
        f"- actors: {', '.join(report['actors'])}",
        f"- integrations: {', '.join(report['integrations'])}",
        "- timeline:",
    ]
    for event in report["events"]:
        status = "ok" if event.success else f"FAIL {event.error_code or 'unknown'}"
        lines.append(
            f"  {_format_dt(event.timestamp)} {event.tool_name} {event.duration_ms}ms {status}"
        )
    return "\n".join(lines)


def format_session_not_found(session_id: str) -> str:
    return "\n".join([
        "Jimmy session",
        f"- session_id: {session_id}",
        "- status: no events found",
    ])


def build_anomalies_report(
    current_events: list[MCPEvent],
    baseline_events: list[MCPEvent],
    *,
    current_days: int,
    baseline_days: int,
    threshold: float,
    integration: str | None = None,
) -> dict[str, Any]:
    def _rates(events: list[MCPEvent], days: int) -> dict[str, Any]:
        total = len(events)
        failures = sum(1 for e in events if not e.success)
        failure_rate = round(failures / total * 100, 1) if total else 0.0
        avg_latency = int(round(mean([e.duration_ms for e in events]))) if events else 0
        tool_counts = Counter(e.tool_name for e in events)
        error_counts = Counter(e.error_code or "unknown" for e in events if not e.success)
        return {
            "days": days,
            "total": total,
            "per_day": round(total / days, 1) if days else 0,
            "failure_rate": failure_rate,
            "avg_latency_ms": avg_latency,
            "tool_counts": tool_counts,
            "error_counts": error_counts,
        }

    current = _rates(current_events, current_days)
    baseline = _rates(baseline_events, baseline_days)

    alerts: list[dict[str, Any]] = []

    # Failure rate spike
    if baseline["failure_rate"] > 0 and current["failure_rate"] > 0:
        ratio = current["failure_rate"] / baseline["failure_rate"]
        if ratio >= threshold:
            alerts.append({
                "signal": "failure_rate",
                "current": f"{current['failure_rate']}%",
                "baseline": f"{baseline['failure_rate']}%",
                "change": f"{ratio:.1f}x",
            })
    elif current["failure_rate"] > 0 and baseline["failure_rate"] == 0:
        alerts.append({
            "signal": "failure_rate",
            "current": f"{current['failure_rate']}%",
            "baseline": "0%",
            "change": "new",
        })

    # Latency spike
    if baseline["avg_latency_ms"] > 0:
        ratio = current["avg_latency_ms"] / baseline["avg_latency_ms"]
        if ratio >= threshold:
            alerts.append({
                "signal": "avg_latency",
                "current": f"{current['avg_latency_ms']}ms",
                "baseline": f"{baseline['avg_latency_ms']}ms",
                "change": f"{ratio:.1f}x",
            })

    # New error codes
    new_errors = set(current["error_counts"]) - set(baseline["error_counts"])
    for code in sorted(new_errors):
        alerts.append({
            "signal": "new_error_code",
            "current": f"{code} ({current['error_counts'][code]})",
            "baseline": "not seen",
            "change": "new",
        })

    # Per-tool failure spikes
    current_tool_failures: dict[str, float] = {}
    baseline_tool_failures: dict[str, float] = {}
    for event in current_events:
        if not event.success:
            current_tool_failures[event.tool_name] = current_tool_failures.get(event.tool_name, 0) + 1
    for event in baseline_events:
        if not event.success:
            baseline_tool_failures[event.tool_name] = baseline_tool_failures.get(event.tool_name, 0) + 1

    for tool_name, current_count in current_tool_failures.items():
        baseline_count = baseline_tool_failures.get(tool_name, 0)
        # Normalize to per-day for fair comparison
        current_per_day = current_count / current_days if current_days else 0
        baseline_per_day = baseline_count / baseline_days if baseline_days else 0
        if baseline_per_day > 0:
            ratio = current_per_day / baseline_per_day
            if ratio >= threshold:
                alerts.append({
                    "signal": f"tool_failures:{tool_name}",
                    "current": f"{current_per_day:.1f}/day",
                    "baseline": f"{baseline_per_day:.1f}/day",
                    "change": f"{ratio:.1f}x",
                })
        elif current_per_day > 0:
            alerts.append({
                "signal": f"tool_failures:{tool_name}",
                "current": f"{current_per_day:.1f}/day",
                "baseline": "0/day",
                "change": "new",
            })

    return {
        "integration_filter": integration,
        "current_window": current,
        "baseline_window": baseline,
        "threshold": threshold,
        "alerts": alerts,
    }


def format_anomalies_report(report: dict[str, Any]) -> str:
    current = report["current_window"]
    baseline = report["baseline_window"]
    lines = [
        "Jimmy anomalies",
        f"- current window: {current['days']}d ({current['total']} events, {current['failure_rate']}% failures, {current['avg_latency_ms']}ms avg)",
        f"- baseline window: {baseline['days']}d ({baseline['total']} events, {baseline['failure_rate']}% failures, {baseline['avg_latency_ms']}ms avg)",
        f"- threshold: {report['threshold']}x",
    ]
    if report["integration_filter"]:
        lines.append(f"- integration filter: {report['integration_filter']}")
    if not report["alerts"]:
        lines.append("- no anomalies detected")
    else:
        lines.append(f"- alerts ({len(report['alerts'])}):")
        for alert in report["alerts"]:
            lines.append(
                f"  - {alert['signal']}: {alert['current']} vs {alert['baseline']} ({alert['change']})"
            )
    return "\n".join(lines)


def build_trace_report(event: MCPEvent) -> dict[str, Any]:
    return {
        "request_id": event.request_id,
        "timestamp": event.timestamp,
        "actor": event.actor,
        "session_id": event.session_id,
        "integration_category": event.integration_category,
        "tool_name": event.tool_name,
        "success": event.success,
        "duration_ms": event.duration_ms,
        "upstream_status": event.upstream_status,
        "scope_required": event.scope_required,
        "error_code": event.error_code,
        "payload_summary": event.payload_summary,
    }


def format_trace_report(report: dict[str, Any]) -> str:
    payload_json = json.dumps(report["payload_summary"], indent=2, sort_keys=True)
    lines = [
        "Jimmy trace",
        f"- request_id: {report['request_id']}",
        f"- timestamp: {_format_dt(report['timestamp'])}",
        f"- actor: {report['actor']}",
        f"- session_id: {report['session_id'] or 'n/a'}",
        f"- integration: {report['integration_category']}",
        f"- tool: {report['tool_name']}",
        f"- success: {str(report['success']).lower()}",
        f"- duration: {report['duration_ms']} ms",
        f"- upstream_status: {report['upstream_status'] if report['upstream_status'] is not None else 'n/a'}",
        f"- scope_required: {report['scope_required'] or 'n/a'}",
        f"- error_code: {report['error_code'] or 'n/a'}",
        "- payload_summary:",
    ]
    lines.extend(f"  {line}" for line in payload_json.splitlines())
    return "\n".join(lines)


def format_trace_not_found(request_id: str, integration: str | None = None) -> str:
    lines = [
        "Jimmy trace",
        f"- request_id: {request_id}",
        "- status: not found",
    ]
    if integration:
        lines.append(f"- integration filter: {integration}")
    return "\n".join(lines)


def _missing_env_vars(names: tuple[str, ...]) -> list[str]:
    return [name for name in names if not os.getenv(name, "").strip()]


def _format_health_report(results: list[HealthCheckResult]) -> str:
    overall_healthy = all(result.healthy for result in results)
    lines = ["Jimmy health"]
    for result in results:
        status = "ok" if result.healthy else "fail"
        lines.append(f"- {result.name}: {status} - {result.detail}")
    lines.append(f"- overall: {'healthy' if overall_healthy else 'unhealthy'}")
    return "\n".join(lines)


async def _check_required_env() -> HealthCheckResult:
    missing = _missing_env_vars(REQUIRED_HEALTH_ENV_VARS)
    if missing:
        return HealthCheckResult("config env", False, f"missing {', '.join(sorted(missing))}")
    return HealthCheckResult("config env", True, "all required env vars are present")


async def _check_supabase_connectivity(store: MCPEventStore) -> HealthCheckResult:
    if not isinstance(store, SupabaseEventStore):
        return HealthCheckResult("supabase connectivity", False, "event store is not configured")
    try:
        await store.fetch_events(MCPEventQuery(limit=1))
    except Exception as exc:
        return HealthCheckResult("supabase connectivity", False, str(exc))
    return HealthCheckResult("supabase connectivity", True, f"reachable table={store.table}")


async def _check_supabase_schema(store: MCPEventStore) -> HealthCheckResult:
    if not isinstance(store, SupabaseEventStore):
        return HealthCheckResult("schema validation", False, "event store is not configured")

    params = [("select", ",".join(REQUIRED_SCHEMA_COLUMNS)), ("limit", "1")]
    try:
        async with httpx.AsyncClient(base_url=store.url, headers=store._headers(), timeout=15.0) as client:
            response = await client.get(f"/rest/v1/{store.table}", params=params)
            response.raise_for_status()
    except Exception as exc:
        return HealthCheckResult("schema validation", False, str(exc))

    return HealthCheckResult("schema validation", True, "required columns are available")


async def _check_ghl_probe() -> HealthCheckResult:
    missing = _missing_env_vars(("GHL_API_KEY", "GHL_LOCATION_ID"))
    if missing:
        return HealthCheckResult("ghl live probe", False, f"missing {', '.join(sorted(missing))}")

    client: GHLClient | None = None
    try:
        client = GHLClient()
        await client.get(f"/locations/{client.location_id}", params={})
    except (ValueError, GHLAPIError, httpx.HTTPError) as exc:
        return HealthCheckResult("ghl live probe", False, str(exc))
    finally:
        if client is not None:
            await client.close()

    return HealthCheckResult("ghl live probe", True, "authenticated location read succeeded")


async def _load_events(
    store: MCPEventStore,
    *,
    days: int | None = None,
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

    return parser


async def run_command(args: argparse.Namespace, *, store: MCPEventStore | None = None) -> str:
    resolved_store = store or create_event_store_from_env()
    store_configured = getattr(resolved_store, "enabled", True)

    if args.command == "health":
        results = [
            await _check_required_env(),
            await _check_supabase_connectivity(resolved_store),
            await _check_supabase_schema(resolved_store),
            await _check_ghl_probe(),
        ]
        output = _format_health_report(results)
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
        query = MCPEventQuery(limit=500)
        all_events = await resolved_store.fetch_events(query)
        session_events = [e for e in all_events if e.session_id == args.session_id]
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
        baseline_events = await _load_events(
            resolved_store,
            days=args.baseline_days,
            limit=args.limit,
            actor=args.actor,
            integration=args.integration,
            tool_name=args.tool,
        )
        report = build_anomalies_report(
            current_events,
            baseline_events,
            current_days=args.current_days,
            baseline_days=args.baseline_days,
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
