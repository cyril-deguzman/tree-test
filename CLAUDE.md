# Tree Testing Web App

## Tech Stack
- **Framework:** SvelteKit (with Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Typography plugin + Forms plugin
- **UI Components:** shadcn-svelte (with bits-ui, lucide-svelte)
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL on Neon (free tier)
- **Package manager:** pnpm
- **Deployment:** Vercel (planned)

## Project Purpose
A tree testing UX research tool where:
1. Researchers create a navigation tree and tasks
2. Participants receive a shareable link, navigate the tree to complete tasks
3. Results are recorded and displayed with analytics

## Data to Record Per Task Response
- Selected node
- Correctness (right/wrong)
- Confidence level (1-10)
- Task duration (ms)
- Time to first click
- Click history as JSON array: `[{ node_id, action (expand|back|select), ts (ms from task start) }]`

## Derived Metrics (computed from click history)
- Directness score: optimal path length / actual path length
- Lostness score: sqrt((N/S - 1)² + (R/N - 1)²) where N=unique nodes, S=min needed, R=total clicks
- First click correctness
- Backtrack count and depth
- Hesitation time (gaps between clicks)
- Recovery efficiency

## Roadmap (incremental)
1. ~~Project setup — scaffold SvelteKit + Tailwind + Drizzle~~ DONE
2. ~~Database schema — define tables, connect to Neon~~ DONE
3. Tree builder — UI for researchers to create a tree (using sample JSON for now)
4. Task creator — add tasks to a study (using sample JSON for now)
5. ~~Test player — participant-facing tree navigation with click tracking~~ DONE
6. Results submission — save responses to DB
7. Results dashboard — view metrics per study

## Database Schema
- **study** — id, title, description, researcher_name, created_at
- **tree** — id, study_id (FK), nodes (JSONB), created_at
- **task** — id, study_id (FK), prompt, expected_node_id, created_at
- **participant** — id, study_id (FK), name (optional), created_at
- **response** — id, participant_id (FK), task_id (FK), selected_node_id, is_correct, confidence, duration_ms, time_to_first_click_ms, click_history (JSONB), created_at

## Key Files
- `src/lib/server/db/schema.ts` — Drizzle table definitions
- `src/lib/server/db/index.ts` — DB client (uses $env/static/private)
- `src/lib/server/db/seed.ts` — Seed script (uses dotenv/config)
- `src/lib/sample-study.json` — Sample tree + tasks data
- `src/routes/study/[id]/+page.server.ts` — Study data loader
- `src/routes/study/[id]/+page.svelte` — Test player UI
- `drizzle.config.ts` — Drizzle Kit config

## Teaching Mode
The user is learning — guide step by step with commands and explanations. Don't write code for them; instruct them what to do.
