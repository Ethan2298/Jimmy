import importlib


def test_ghl_compat_shim_exports_jimmy_server():
    ghl_server = importlib.import_module("mcp_servers.ghl.server")
    jimmy_server = importlib.import_module("mcp_servers.jimmy.server")

    assert ghl_server.mcp is jimmy_server.mcp
