# Pipeline Audit

Skill: pipeline-audit
Description: Deep review of all pipelines — stale deals, missing data, health score
Mode: review

## Instructions
1. Call get_pipelines to enumerate all pipelines and their stages.
2. For each pipeline, call search_opportunities with status "open" to pull all active deals (paginate if needed with limit=50).
3. Analyze each deal:
   - How long has it been in the current stage? (compare dateAdded/lastStageChangeAt to today)
   - Does it have a monetary value set? (flag $0 deals)
   - Is there a contact linked?
   - Call get_contact_notes on linked contacts to check for recent activity
4. Flag issues:
   - Deals with $0 or no monetary value
   - Deals with no linked contact
   - Deals in the same stage for 14+ days
   - Deals with no notes or tasks in the last 30 days
5. Present findings grouped by pipeline:
   - **Healthy**: Active, valued, moving through stages
   - **At-Risk**: Stale, missing data, or no recent activity
   - Recommended action for each at-risk deal (archive, follow up, update value, etc.)
6. Calculate overall pipeline health: percentage of healthy deals vs total.
7. If there are patterns in lost deals (call search_opportunities with status "lost" and limit=20), note common themes — same vehicle type, same source, same stage where they drop off.
