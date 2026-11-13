# todo

Personal day/week/month planner with boards. Plan: [docs/PLAN.md](docs/PLAN.md).

Next 16 · React 19 · Tailwind v4 · shadcn (Base UI) · Supabase · Drizzle.

## Run

Needs Docker Desktop, the Supabase CLI and Node 24 (`nvm use`).

```bash
npm install
npm run dev      # preflight: starts Supabase, fills .env.local, migrates
```

| Service | URL |
|---|---|
| Supabase API | http://127.0.0.1:54411 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54412/postgres |
| Studio | http://127.0.0.1:54413 |
| Mailpit (sign-in emails) | http://127.0.0.1:54414 |

Ports are pipline-app's +60, so both stacks run side by side.
`npm run verify` = lint + typecheck + test.
