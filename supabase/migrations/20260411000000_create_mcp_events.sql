create table if not exists public.mcp_events (
    request_id text primary key,
    occurred_at timestamptz not null default timezone('utc', now()),
    actor text not null,
    session_id text,
    tool_name text not null,
    duration_ms integer not null default 0,
    success boolean not null,
    error_code text,
    scope_required text,
    upstream_status integer,
    payload_summary jsonb not null default '{}'::jsonb
);

create index if not exists mcp_events_occurred_at_idx on public.mcp_events (occurred_at desc);
create index if not exists mcp_events_actor_idx on public.mcp_events (actor);
create index if not exists mcp_events_tool_name_idx on public.mcp_events (tool_name);
