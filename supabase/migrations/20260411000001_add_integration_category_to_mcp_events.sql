alter table if exists public.mcp_events
    add column if not exists integration_category text not null default 'GHL';

update public.mcp_events
set integration_category = coalesce(nullif(integration_category, ''), 'GHL')
where integration_category is null or integration_category = '';

create index if not exists mcp_events_integration_category_idx on public.mcp_events (integration_category);
