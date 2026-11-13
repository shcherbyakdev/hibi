# hibi

hibi (日々, "day after day") — a personal day/week/month planner with boards. Plan: [docs/PLAN.md](docs/PLAN.md).

Next 16 · React 19 · Tailwind v4 · shadcn (Base UI) · Supabase · Drizzle.

## Run

Needs Docker Desktop, the Supabase CLI and Node 24 (`nvm use`).

```bash
npm install
npm run dev      # preflight: starts Supabase, fills .env.local, migrates
```

| Service | URL |
|---|---|
| App | http://localhost:3100 |
| Supabase API | http://127.0.0.1:54411 |
| Postgres | postgresql://postgres:postgres@127.0.0.1:54412/postgres |
| Studio | http://127.0.0.1:54413 |
| Mailpit (sign-in emails) | http://127.0.0.1:54414 |

Ports are pipline-app's +60 (app on 3100), so both run side by side.
`npm run verify` = lint + typecheck + test.

## CI

`.github/workflows/ci.yml` on every PR and push to `main`: lint, typecheck,
unit tests, production build, and a `db` job that starts a throwaway
Supabase (CLI pinned to 2.75.0), applies every migration to an empty
database, fails on schema/migration drift, and runs the integration tests.
Require the single `ci` check in branch protection.

## Production environment

Set in Vercel (never locally or in CI):

| Variable | Value |
|---|---|
| `APP_ENV` | `production` — turns on the checks in `src/env-schema.ts` |
| `NEXT_PUBLIC_APP_URL` | the public `https://` URL (email links point here) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the production project |

With `APP_ENV=production` the build fails if the app URL is missing,
local or not https, or if Supabase is local. Production Supabase also
needs: site URL + redirect URLs set to the domain, the migrations applied
(`ALLOW_REMOTE_DB=1 npx drizzle-kit migrate` with the production
`DATABASE_URL`), and a real SMTP provider (the built-in mailer allows
only a couple of emails per hour).
