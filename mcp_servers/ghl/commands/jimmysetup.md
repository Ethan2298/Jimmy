---
description: Set up Jimmy — install skills, verify GHL connection, configure commands
---

# Jimmy Setup

Run the full Jimmy setup flow.

## What to do

1. Call the `jimmy_setup` MCP tool with no arguments.
2. Check the `connection` field in the response:
   - If connected, note the location name.
   - If not connected, tell the user the error and stop.
3. For each item in the `commands` array, write the file to `.claude/commands/<filename>`. Overwrite if it already exists.
4. Report to the user:
   - Connection status and location name
   - How many skills were installed vs already existed
   - List each available skill with its description
   - Tell them they can run `/jimmy` to see skills or `/jimmy [name]` to run one
   - Tell them `/jimmy-build` creates custom skills
