from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from typing import Any

import httpx

_SENTINEL = object()

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Read prefixes — tools starting with these are classified as read-only
_READ_PREFIXES = ("search_", "get_", "list_")
# Read exact names — full tool names that are read-only despite not matching prefixes
_READ_EXACT = frozenset(("kb_list", "kb_read", "kb_search", "memory_read", "memory_search", "memory_list"))


async def _load_local_tools() -> list[dict[str, Any]]:
    import importlib
    ghl_api_key = os.environ.get("GHL_API_KEY")
    ghl_location_id = os.environ.get("GHL_LOCATION_ID")
    os.environ.setdefault("GHL_API_KEY", "__inspect__")
    os.environ.setdefault("GHL_LOCATION_ID", "__inspect__")
    try:
        module = importlib.import_module("mcp_servers.ghl.server")
        mcp_app = getattr(module, "mcp")
        tools = await mcp_app.list_tools()
    finally:
        if ghl_api_key is None:
            os.environ.pop("GHL_API_KEY", None)
        if ghl_location_id is None:
            os.environ.pop("GHL_LOCATION_ID", None)
    return [_tool_to_dict(tool) for tool in tools]


async def _load_remote_tools(url: str, auth_token: str) -> list[dict[str, Any]]:
    from mcp.client.streamable_http import streamable_http_client
    from mcp.client.session import ClientSession

    async with httpx.AsyncClient(headers={"Authorization": f"Bearer {auth_token}"}) as http_client:
        async with streamable_http_client(url, http_client=http_client) as (read_stream, write_stream, _):
            async with ClientSession(read_stream, write_stream) as session:
                await session.initialize()
                result = await session.list_tools()
                return [_tool_to_dict(tool) for tool in result.tools]


def _tool_to_dict(tool: Any) -> dict[str, Any]:
    schema = tool.inputSchema or {}
    props = schema.get("properties", {})
    required = set(schema.get("required", []))
    params = []
    for name, prop in props.items():
        ptype = prop.get("type", "any")
        if "anyOf" in prop:
            ptype = " | ".join(t.get("type", "?") for t in prop["anyOf"] if t.get("type") != "null")
            if any(t.get("type") == "null" for t in prop["anyOf"]):
                ptype += "?"
        default = prop.get("default", _SENTINEL)
        params.append({
            "name": name,
            "type": ptype,
            "required": name in required,
            "default": default if default is not _SENTINEL else None,
            "has_default": default is not _SENTINEL,
        })
    description = (tool.description or "").strip()
    first_line = description.split("\n")[0].strip() if description else ""
    return {
        "name": tool.name,
        "description": first_line,
        "full_description": description,
        "param_count": len(params),
        "params": params,
    }


def _is_read_tool(name: str) -> bool:
    return name.startswith(_READ_PREFIXES) or name in _READ_EXACT


def _categorize_tools(tools: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Categorize tools by naming convention: prefix before first underscore."""
    # Well-known prefix groups for clean display names
    _DISPLAY_NAMES: dict[str, str] = {
        "search": "contacts",
        "get": "contacts",
        "create": "contacts",
        "update": "contacts",
        "delete": "contacts",
        "add": "contacts",
        "remove": "contacts",
    }
    # Override: explicit category rules by tool name prefix
    _CATEGORY_RULES: list[tuple[tuple[str, ...], str]] = [
        (("search_contacts", "get_contact", "create_or_update_contact", "update_contact", "delete_contact", "add_contact_tags", "remove_contact_tags"), "contacts"),
        (("search_conversations", "get_conversation_messages", "send_message", "update_conversation"), "conversations"),
        (("get_pipelines", "search_opportunities", "get_opportunity", "create_opportunity", "update_opportunity", "delete_opportunity"), "opportunities"),
        (("list_calendars", "get_calendar_events", "get_calendar_free_slots", "book_appointment", "update_appointment", "delete_appointment"), "calendar"),
        (("get_contact_notes", "add_contact_note", "get_contact_tasks", "create_contact_task"), "notes & tasks"),
        (("get_location", "get_location_custom_fields", "get_location_tags", "get_users", "get_user"), "location"),
    ]

    # Build lookup from rules
    name_to_category: dict[str, str] = {}
    for tool_names, category in _CATEGORY_RULES:
        for tool_name in tool_names:
            name_to_category[tool_name] = category

    # For tools not in explicit rules, categorize by prefix (kb_, memory_, jimmy_)
    categorized: dict[str, list[dict[str, Any]]] = {}
    for tool in tools:
        name = tool["name"]
        if name in name_to_category:
            category = name_to_category[name]
        elif name.startswith("kb_"):
            category = "knowledge base"
        elif name.startswith("memory_"):
            category = "memory"
        elif name.startswith("jimmy_"):
            category = "jimmy"
        elif name == "get_dealer_context":
            category = "jimmy"
        else:
            category = "other"
        categorized.setdefault(category, []).append(tool)

    return categorized


def build_inspect_report(tools: list[dict[str, Any]], *, mode: str, show_schema: bool, tool_filter: str | None = None) -> dict[str, Any]:
    if tool_filter:
        tools = [t for t in tools if tool_filter.lower() in t["name"].lower()]
    categories = _categorize_tools(tools)
    read_tools = [t for t in tools if _is_read_tool(t["name"])]
    write_tools = [t for t in tools if not _is_read_tool(t["name"])]
    return {
        "mode": mode,
        "tool_count": len(tools),
        "read_count": len(read_tools),
        "write_count": len(write_tools),
        "categories": categories,
        "tools": tools,
        "show_schema": show_schema,
        "tool_filter": tool_filter,
    }


def format_inspect_report(report: dict[str, Any]) -> str:
    lines = [
        "Jimmy inspect",
        f"- mode: {report['mode']}",
        f"- tools: {report['tool_count']} ({report['read_count']} read, {report['write_count']} write)",
    ]
    if report["tool_filter"]:
        lines.append(f"- filter: {report['tool_filter']}")

    for category, tools in report["categories"].items():
        lines.append(f"\n  [{category}] ({len(tools)} tools)")
        for tool in tools:
            param_summary = ", ".join(
                f"{'*' if p['required'] else ''}{p['name']}:{p['type']}" for p in tool["params"]
            )
            lines.append(f"    {tool['name']}({param_summary})")
            if tool["description"]:
                lines.append(f"      {tool['description']}")
            if report["show_schema"]:
                for param in tool["params"]:
                    req = "required" if param["required"] else "optional"
                    default_str = f", default={param['default']}" if param["has_default"] else ""
                    lines.append(f"        - {param['name']}: {param['type']} ({req}{default_str})")

    return "\n".join(lines)


# --- official MCP Inspector launcher ---


def build_inspector_command(
    *,
    cli_mode: bool = False,
    remote_url: str | None = None,
    auth_token: str | None = None,
    port: int | None = None,
    server_port: int | None = None,
) -> dict[str, Any]:
    npx = shutil.which("npx")
    if not npx:
        return {"ok": False, "error": "npx not found. Install Node.js to use the MCP Inspector."}

    env = dict(os.environ)

    if remote_url:
        token = auth_token or os.getenv("MCP_AUTH_TOKEN", "").strip()
        cmd = [npx, "@modelcontextprotocol/inspector", "--method", "streamableHttp"]
        env["MCP_SERVER_URL"] = remote_url
        if token:
            env["MCP_HEADERS"] = json.dumps({"Authorization": f"Bearer {token}"})
    else:
        cmd = [npx, "@modelcontextprotocol/inspector", sys.executable, "-m", "mcp_servers.ghl.server"]
        env.setdefault("GHL_API_KEY", os.getenv("GHL_API_KEY", ""))
        env.setdefault("GHL_LOCATION_ID", os.getenv("GHL_LOCATION_ID", ""))

    if cli_mode:
        cmd.insert(2, "--cli")

    if port:
        env["CLIENT_PORT"] = str(port)
    if server_port:
        env["SERVER_PORT"] = str(server_port)

    mode = "cli" if cli_mode else "ui"
    target = remote_url or "local (mcp_servers.ghl.server)"

    return {
        "ok": True,
        "cmd": cmd,
        "env": env,
        "mode": mode,
        "target": target,
        "port": port or 6274,
        "server_port": server_port or 6277,
    }


def format_inspector_launch(result: dict[str, Any]) -> str:
    if not result["ok"]:
        return f"Jimmy inspector\n- error: {result['error']}"
    lines = [
        "Jimmy inspector",
        f"- mode: {result['mode']}",
        f"- target: {result['target']}",
        f"- command: {' '.join(result['cmd'])}",
    ]
    if result["mode"] == "ui":
        lines.append(f"- UI: http://localhost:{result['port']}")
        lines.append(f"- proxy: http://localhost:{result['server_port']}")
    return "\n".join(lines)


def run_inspector(result: dict[str, Any]) -> int:
    if not result["ok"]:
        print(format_inspector_launch(result), file=sys.stderr)
        return 1
    print(format_inspector_launch(result))
    print("launching...\n")
    try:
        proc = subprocess.run(result["cmd"], env=result["env"], cwd=PROJECT_ROOT)
        return proc.returncode
    except KeyboardInterrupt:
        return 0
