# Dev Workflow — Jimmy

## Pipeline Stages

Every piece of work moves through these stages, in order. No skipping.

### 1. Backlog

Defined enough to pick up. Has a clear description of what needs to happen and why. Not started.

### 2. In Progress

Actively being developed on a branch. Code is being written.

### 3. Checks Passing

All three gates green:

```bash
npm run lint          # ESLint — core web vitals + TS rules
npx tsc --noEmit      # TypeScript strict mode type check
npm run build         # Next.js production build
```

If any gate fails, the work stays In Progress until fixed.

### 4. Testing

Manual verification on `localhost:3000` or a Vercel preview URL. Test the golden path and edge cases. For GHL integration work, run `/testjimmy` to verify MCP tools still work.

### 5. Shipped

Merged to `master`, live on Vercel at `https://jimmy-sooty.vercel.app`. Verified with a health check. Use `/pushtoprodjimmy` for the deployment flow.

### 6. Blocked

Waiting on something external — GHL API scopes, third-party access, a decision that hasn't been made. The Notes field on the task must explain what's blocking it and what unblocks it.

---

## Categories

| Category | What it covers |
|---|---|
| `feature` | New user-facing functionality |
| `fix` | Bug fix for existing behavior |
| `infra` | Build tooling, CI, config, deployment |
| `ghl-integration` | GHL MCP tools, API connections, CRM data |
| `ui` | Frontend components, styling, layout |
| `ai` | Marcus personality, prompt engineering, AI SDK |

## Priority

Three levels. No more.

| Priority | Meaning |
|---|---|
| `now` | Drop everything, do this first |
| `next` | Pick up when current work ships |
| `later` | Defined but not urgent |
