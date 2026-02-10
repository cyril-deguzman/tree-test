# Tree Testing Web App

A UX research tool for **tree testing** — a method where participants navigate a text-based tree structure to find where they'd expect certain content to live. Researchers create a navigation tree and tasks, share a link with participants, and view analytics on how people navigated.

## Tech Stack

| Layer | Tool |
|-------|------|
| Framework | SvelteKit (Svelte 5 with runes) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 (OKLCH colors) + Typography + Forms plugins |
| UI Components | shadcn-svelte (bits-ui, lucide-svelte) |
| ORM | Drizzle ORM |
| Database | PostgreSQL on Neon (serverless driver) |
| Package manager | pnpm |
| Deployment | Vercel (adapter-auto) |

## Project Structure

```
src/
├── lib/
│   ├── components/ui/          # shadcn-svelte components
│   │   ├── badge/
│   │   ├── button/
│   │   ├── card/
│   │   ├── dialog/
│   │   ├── input/
│   │   ├── slider/
│   │   └── table/
│   ├── server/db/
│   │   ├── schema.ts           # Drizzle table definitions (5 tables)
│   │   ├── index.ts            # DB client (uses $env/static/private)
│   │   └── seed.ts             # Seed script (uses dotenv/config + process.env)
│   ├── sample-study.json       # Sample tree + tasks for seeding
│   └── utils.ts                # cn() helper for Tailwind class merging
├── routes/
│   ├── +layout.svelte          # Root layout (imports CSS, favicon)
│   ├── +page.svelte            # Home page (placeholder)
│   ├── layout.css              # Tailwind base + theme variables
│   └── study/[id]/
│       ├── +page.server.ts     # Loads study, tree, tasks by UUID
│       ├── +page.svelte        # Test player UI (participant-facing)
│       ├── submit/
│       │   └── +server.ts      # POST endpoint — saves participant + responses
│       └── results/
│           ├── +page.server.ts # Computes all metrics, builds CSV data
│           └── +page.svelte    # Results dashboard with tables, modals, CSV export
```

## Database Schema

All IDs are UUIDs. All tables cascade on delete from their parent.

```
study
├── id (PK), title, description, created_at
│
├── tree (1:1)
│   ├── id (PK), study_id (FK), nodes (JSONB), created_at
│
├── task (1:many)
│   ├── id (PK), study_id (FK), prompt, expected_node_id, created_at
│
└── participant (1:many)
    ├── id (PK), study_id (FK), name (optional), created_at
    │
    └── response (1:many, one per task)
        ├── id (PK), participant_id (FK), task_id (FK)
        ├── selected_node_id, is_correct, confidence (1-10)
        ├── duration_ms, time_to_first_click_ms
        ├── click_history (JSONB), created_at
```

## Tree Node Structure

The tree is stored as a nested JSONB blob in the `tree` table. Every node has:

```json
{ "id": "unique-string", "label": "Display Name", "children": [ ...child nodes ] }
```

- The root node's `id` should be `"root"`
- Leaf nodes must have `"children": []`
- Nesting depth is unlimited

## Click History Format

Each participant action during a task is recorded as:

```json
{ "node_id": "electronics", "action": "expand", "ts": 1250 }
```

- `action` is one of: `"expand"` (drill into node), `"back"` (collapse/navigate up), `"select"` (choose leaf)
- `ts` is milliseconds since the task started (relative, not absolute)

## Test Player Flow (src/routes/study/[id]/+page.svelte)

1. **Welcome** — study description, optional name input
2. **Task** — participant clicks "Start Task", then navigates the tree
   - A `__wrapper` invisible node wraps the root so "Home" appears as a clickable option
   - The participant must click Home to expand it (it is NOT auto-expanded)
   - Every expand/back/select action is recorded in `clickHistory`
   - Participant can skip a task at any time
3. **Confidence** — slider from 1 to 10
4. **Done** — all responses are POSTed to `/study/[id]/submit` as a batch

## Metrics (src/routes/study/[id]/results/+page.server.ts)

All metrics are computed at view time from the stored `click_history`, not pre-computed.

### Per-response metrics

| Metric | Formula | Notes |
|--------|---------|-------|
| Directness | `optimalPathLength / totalClicks` | 1.0 = perfect, lower = wandered |
| Lostness | `sqrt((N/S - 1)² + (R/N - 1)²)` | N=unique nodes, S=optimal, R=total clicks. 0 = perfect |
| Backtrack count | count of `"back"` actions | |
| Avg hesitation | mean time gap between consecutive clicks (ms) | |
| First click node | `clickHistory[0].node_id` | |

### Optimal path length

`findOptimalPathLength(root, targetId, depth=1)` counts the root node as depth 1 (one click) because participants must manually expand it. This means optimal path length = number of clicks for a participant who goes straight to the answer with no wrong turns.

`buildDepthMap` is defined but currently unused. Note: it starts at depth=0 (tree-theoretic depth), which differs from `findOptimalPathLength`'s depth=1 (click count).

### Per-task aggregates

Success rate, avg duration, avg confidence, avg directness, avg lostness — all computed over every response including skipped ones (skipped = `selectedNodeId` is null, `isCorrect` is false).

## API Endpoints

### `POST /study/[id]/submit`

```json
{
  "participantName": "Alice",
  "responses": [
    {
      "taskId": "uuid",
      "selectedNodeId": "password",
      "isCorrect": true,
      "confidence": 8,
      "durationMs": 4500,
      "timeToFirstClickMs": 1200,
      "clickHistory": [...]
    }
  ]
}
```

Returns `{ success: true, participantId: "uuid" }`.

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm db:seed          # Seed DB from sample-study.json (creates a new study each run)
pnpm prepare          # Run svelte-kit sync (regenerates $types)
pnpm check            # Type-check the project
pnpm lint             # Prettier + ESLint check
pnpm format           # Auto-format with Prettier
pnpm drizzle-kit push # Push schema changes to Neon
```

## Environment

Requires a `.env` file in the project root:

```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

- SvelteKit server code uses `$env/static/private` (not `process.env`)
- The seed script (`seed.ts`) uses `dotenv/config` + `process.env` because it runs outside SvelteKit

## How to Create a New Study

1. Edit `src/lib/sample-study.json` with your tree and tasks
2. Run `pnpm db:seed` — it prints the new study UUID
3. Participant URL: `/study/<uuid>`
4. Results URL: `/study/<uuid>/results`
5. Each seed run creates a fresh study — it never overwrites existing data

## Svelte 5 Patterns Used

- `$state()` for local reactive state
- `$derived()` for computed values (never reference `$props()` data in `$state()` initializers)
- `$props()` for component props
- Svelte snippets (`{#snippet}` / `{@render}`) for recursive tree rendering
- No stores — all state is component-local

## shadcn-svelte Components Installed

Badge, Button, Card, Dialog, Input, Slider, Table

Add new ones with: `pnpm dlx shadcn-svelte@latest add <component>`

## Roadmap

- [x] Project setup (SvelteKit + Tailwind + Drizzle)
- [x] Database schema (5 tables on Neon)
- [ ] Tree builder UI (currently using sample JSON)
- [ ] Task creator UI (currently using sample JSON)
- [x] Test player (tree navigation + click tracking)
- [x] Response submission (POST to DB)
- [x] Results dashboard (metrics, per-response table, path visualization, CSV export)
