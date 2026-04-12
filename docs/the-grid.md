# The Grid — MCP Development Tracker

Development board for the Jimmy MCP server. Tools, skills, workflows, analytics, and hardening.

---

## Sections

### Programs (Tools)
Each MCP tool is a program. Track build status, test coverage, and edge cases.

#### Live Programs (46)
| Program | Zone | Status |
|---------|------|--------|
| `search_contacts` | contacts | live |
| `get_contact` | contacts | live |
| `create_or_update_contact` | contacts | live |
| `update_contact` | contacts | live |
| `delete_contact` | contacts | live |
| `add_contact_tags` | contacts | live |
| `remove_contact_tags` | contacts | live |
| `get_contact_notes` | contacts | live |
| `add_contact_note` | contacts | live |
| `get_contact_tasks` | contacts | live |
| `create_contact_task` | contacts | live |
| `search_conversations` | conversations | live |
| `get_conversation_messages` | conversations | live |
| `send_message` | conversations | live |
| `update_conversation` | conversations | live |
| `get_pipelines` | pipeline | live |
| `search_opportunities` | pipeline | live |
| `get_opportunity` | pipeline | live |
| `create_opportunity` | pipeline | live |
| `update_opportunity` | pipeline | live |
| `delete_opportunity` | pipeline | live |
| `list_calendars` | calendar | live |
| `get_calendar_events` | calendar | live |
| `get_calendar_free_slots` | calendar | live |
| `book_appointment` | calendar | live |
| `update_appointment` | calendar | live |
| `delete_appointment` | calendar | live |
| `get_location` | admin | live |
| `get_location_custom_fields` | admin | live |
| `get_location_tags` | admin | live |
| `get_users` | admin | live |
| `get_user` | admin | live |
| `get_dealer_context` | system | live |
| `kb_list` | knowledge | live |
| `kb_read` | knowledge | live |
| `kb_write` | knowledge | live |
| `kb_search` | knowledge | live |
| `kb_delete` | knowledge | live |
| `jimmy_skills` | skills | live |
| `jimmy_run_skill` | skills | live |
| `jimmy_settings` | skills | live |
| `jimmy_setup` | skills | live |
| `memory_write` | memory | live |
| `memory_read` | memory | live |
| `memory_search` | memory | live |
| `memory_list` | memory | live |
| `memory_delete` | memory | live |

| `analytics_status` | telemetry | live |
| `analytics_failures` | telemetry | live |
| `analytics_usage` | telemetry | live |
| `analytics_latency` | telemetry | live |

| `prepare_context` | system | live |

#### Queued Programs
| `bulk_tag` | contacts | Tag multiple contacts in one call | P3 |
| `bulk_update_stage` | pipeline | Move multiple deals in one call | P3 |
| `scope_check` | admin | Test each endpoint category, report what works/doesn't | P3 |
| `log_outcome` | telemetry | Tag a conversation with result (booked/sold/lost/no-reply) | P3 |

---

### Routines (Skills)
Each skill is a workflow that chains multiple programs.

#### Live Routines (7)
| Routine | Mode | What it does |
|---------|------|-------------|
| `morning-brief` | review | Daily pipeline + inbox + calendar snapshot |
| `triage` | plan | Classify inbound leads HOT/WARM/COLD |
| `pipeline-audit` | review | Flag stale deals, missing data, health % |
| `contact` | plan | Full contact profile + history + actions |
| `deal` | plan | Deep-dive on a specific opportunity |
| `follow-ups` | plan | Overdue tasks + pending follow-ups |
| `template` | — | Skeleton for building new skills |

| `inbox` | plan | Unread/unanswered messages ranked by urgency |
| `send` | execute | Context-aware message drafting + send with confirmation |

| `book` | execute | End-to-end appointment booking (free slots → book → confirm) |
| `new-lead` | execute | Intake: create contact, tag, create opportunity, log note |
| `send-template` | execute | Load a message template, fill variables, send |

#### Queued Routines
| `weekly-review` | review | Won/lost this week, velocity, follow-up completion, patterns | P2 |
| `inventory-search` | plan | Search GHL products/custom objects for vehicles | P3 |
| `health-check` | review | Proactive error/scope failure check at session start | P3 |

---

### Cycles (Sprints)

#### Cycle 1 — Telemetry & Inbox
Goal: Make the MCP observable and handle the most common dealer question.

- [x] Wire `analytics_status` tool (logic exists in cli.py)
- [x] Wire `analytics_failures` tool
- [x] Wire `analytics_usage` tool
- [x] Wire `analytics_latency` tool
- [x] Build `inbox` skill
- [x] Build `send` skill
- [ ] Test all against live GHL data

#### Cycle 2 — Workflows & Context
Goal: Reduce tool-call overhead, streamline common actions.

- [x] Build `prepare_context` tool
- [x] Build `book` skill
- [x] Build `new-lead` skill
- [x] Add message templates to KB (follow-up, appointment-confirm, intro, post-visit)
- [x] Build `send-template` skill

#### Cycle 3 — Intelligence & Hardening
Goal: Close the feedback loop, add bulk ops, harden edge cases.

- [ ] Build `weekly-review` skill
- [ ] Build `log_outcome` tool
- [ ] Build `scope_check` tool
- [ ] Build `bulk_tag` tool
- [ ] Build `bulk_update_stage` tool
- [ ] Build `health-check` skill
- [ ] Session-level analytics grouping
- [ ] Daily delta comparisons in morning-brief

---

### Diagnostics (Bugs & Edge Cases)
Track issues found during hardening.

| ID | Description | Zone | Status |
|----|-------------|------|--------|
| — | (empty — add as discovered) | — | — |

---

### Uplink (Integrations & Infra)
External dependencies and configuration.

| System | Status | Notes |
|--------|--------|-------|
| GHL API (read scopes) | live | contacts, conversations, opportunities, calendars |
| GHL API (write scopes) | needs setup | contacts.write, conversations/message.write, opportunities.write, calendars.write, calendars/events.write |
| Supabase Auth | live | Dealer login |
| Supabase mcp_events | live | Telemetry table |
| Supabase knowledge_base | live | KB storage |
| Supabase memory | needs verify | Memory table existence |
| OAuth 2.1 (MCP auth) | live | PIN-based + client_credentials |
| Vercel deployment | live | Next.js app |

---

### Lightcycle (Changelog)
What shipped, when.

| Date | What shipped |
|------|-------------|
| 2026-04-12 | Marcus → Jimmy rename (system prompt, UI, all docs) |
| 2026-04-12 | Codebase architecture audit + The Grid created |
| 2026-04-12 | Cycle 1: analytics tools (status, failures, usage, latency) wired as MCP tools |
| 2026-04-12 | Cycle 1: inbox skill — surface unanswered convos ranked by urgency |
| 2026-04-12 | Cycle 1: send skill — context-aware message drafting + send with memory |
| 2026-04-12 | Cycle 2: prepare_context tool — bundles contact/convos/deals/notes/tasks/memory in one call |
| 2026-04-12 | Cycle 2: book skill — end-to-end appointment booking with confirmation |
| 2026-04-12 | Cycle 2: new-lead skill — intake flow: create contact, tag, create deal, log note |
| 2026-04-12 | Cycle 2: send-template skill + 4 starter templates (follow-up, appointment-confirm, intro, post-visit) |
