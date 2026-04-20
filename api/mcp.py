"""
Vercel serverless function — serves the GHL MCP server over Streamable HTTP.

Claude Desktop / claude.ai connect to: https://<your-app>.vercel.app/api/mcp
"""

import os
import sys

# Project root on sys.path so mcp_servers package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from mcp.server.transport_security import TransportSecuritySettings
from mcp_servers.ghl.server import mcp

# --- Serverless-friendly settings ---
mcp.settings.stateless_http = True

# Critical: Vercel routes /api/mcp to this function. The Starlette app inside
# needs to match on that same path. If Vercel passes the full path through,
# "/api/mcp" is correct. If it strips the prefix, use "/".
# Based on @vercel/python ASGI behavior, the full path is preserved.
mcp.settings.streamable_http_path = "/api/mcp"

# Disable DNS rebinding protection — Vercel handles host validation at the edge.
mcp.settings.transport_security = TransportSecuritySettings(
    enable_dns_rebinding_protection=False,
)

# --- Build the Starlette ASGI app ---
app = mcp.streamable_http_app()
