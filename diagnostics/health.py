from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

import httpx

from mcp_servers.ghl.client import GHLAPIError, GHLClient
from diagnostics.telemetry import MCPEventQuery, MCPEventStore, SupabaseEventStore

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


@dataclass(slots=True)
class HealthCheckResult:
    name: str
    healthy: bool
    detail: str


def _missing_env_vars(names: tuple[str, ...]) -> list[str]:
    return [name for name in names if not os.getenv(name, "").strip()]


def format_health_report(results: list[HealthCheckResult]) -> str:
    overall_healthy = all(result.healthy for result in results)
    lines = ["Jimmy health"]
    for result in results:
        status = "ok" if result.healthy else "fail"
        lines.append(f"- {result.name}: {status} - {result.detail}")
    lines.append(f"- overall: {'healthy' if overall_healthy else 'unhealthy'}")
    return "\n".join(lines)


async def check_required_env() -> HealthCheckResult:
    missing = _missing_env_vars(REQUIRED_HEALTH_ENV_VARS)
    if missing:
        return HealthCheckResult("config env", False, f"missing {', '.join(sorted(missing))}")
    return HealthCheckResult("config env", True, "all required env vars are present")


async def check_supabase_connectivity(store: MCPEventStore) -> HealthCheckResult:
    if not isinstance(store, SupabaseEventStore):
        return HealthCheckResult("supabase connectivity", False, "event store is not configured")
    try:
        await store.fetch_events(MCPEventQuery(limit=1))
    except Exception as exc:
        return HealthCheckResult("supabase connectivity", False, str(exc))
    return HealthCheckResult("supabase connectivity", True, f"reachable table={store.table}")


async def check_supabase_schema(store: MCPEventStore) -> HealthCheckResult:
    if not isinstance(store, SupabaseEventStore):
        return HealthCheckResult("schema validation", False, "event store is not configured")

    try:
        await store.check_schema(REQUIRED_SCHEMA_COLUMNS)
    except Exception as exc:
        return HealthCheckResult("schema validation", False, str(exc))

    return HealthCheckResult("schema validation", True, "required columns are available")


async def check_ghl_probe() -> HealthCheckResult:
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
