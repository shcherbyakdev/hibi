# hibi

hibi (日々, "day after day") is a quiet planner for your day, week and month,
with goals and routines. It's local-first: every device keeps a full copy and
syncs in the background.

- **Web:** https://hibiapp.vercel.app (invite-only for now)
- **Mac:** [download hibi.dmg](https://github.com/shcherbyakdev/hibi/releases/latest/download/hibi.dmg). No account; your data stays on your Mac.

## Tech stack

| Area | Tools |
|---|---|
| **Web app** | [Next.js](https://nextjs.org) 16 (App Router), [React](https://react.dev) 19, [TypeScript](https://www.typescriptlang.org) 6 |
| **UI** | [Tailwind CSS](https://tailwindcss.com) v4, [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com), [class-variance-authority](https://cva.style), tailwind-merge, clsx, tw-animate-css, [next-themes](https://github.com/pacocoursey/next-themes) |
| **UI pieces** | [dnd-kit](https://dndkit.com) (drag and drop), [cmdk](https://cmdk.paco.me) (⌘K search), [Sonner](https://sonner.emilkowal.ski) (toasts), [Hugeicons](https://hugeicons.com) and [Lucide](https://lucide.dev) (icons) |
| **Type** | Geist and Geist Mono (UI), Outfit (wordmark), via `next/font` |
| **Local-first data** | [Dexie](https://dexie.org) (IndexedDB) + dexie-react-hooks, fractional-indexing (ordering), [Zod](https://zod.dev) (validation) |
| **Backend (web)** | [Supabase](https://supabase.com): Postgres, Auth, Realtime (`@supabase/ssr`, `supabase-js`), [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit (schema and migrations), postgres.js |
| **Desktop** | [Go](https://go.dev) 1.26, [Wails](https://wails.io) v2.17 (native window), [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) (pure-Go SQLite), a self-updater verified with Ed25519 (Go stdlib) |
| **Testing** | [Vitest](https://vitest.dev), fake-indexeddb, a sync contract suite run against Supabase and the Go service, `go test` |
| **Tooling** | ESLint (eslint-config-next), tsx, shadcn CLI, [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), Docker, Node 24 |
| **Infra** | [Vercel](https://vercel.com) (hosting), Supabase Cloud, GitHub Actions (CI and desktop releases), GitHub Releases (Mac downloads and update feed) |

## Run locally

Needs Node 24 (`nvm use`), Docker Desktop and the Supabase CLI.

```bash
npm install
npm run dev      # starts Supabase, fills .env.local, migrates; app on :3100
```

| Service | URL |
|---|---|
| App | http://localhost:3100 |
| Supabase Studio | http://127.0.0.1:54413 |
| Mailpit (sign-in emails) | http://127.0.0.1:54414 |

| Command | Does |
|---|---|
| `npm run verify` | lint + typecheck + unit tests |
| `npm run test:integration` | the sync contract against local Supabase and the Go service |
| `npm run db:generate` / `db:migrate` | new migration from `src/db/schema` / apply it |
| `npm run desktop:build` | the Mac app → `desktop/build/bin/hibi.app` (needs Go and Wails) |

## Project map

```text
src/
├── app/            # routes (*.hosted.tsx exist only in the web build)
├── features/       # planner, goals, routines, items, time, settings, auth
├── components/     # shell, shared pieces, shadcn ui
├── lib/sync/       # local-first engine + transports (Supabase, HTTP)
├── edition/        # what differs between web (hosted/) and Mac (desktop/)
└── db/             # Drizzle schema and migrations
desktop/
├── syncsvc/        # Go sync service: SQLite store, rules, guards, SSE
├── update/         # signed self-updater
├── cmd/            # hibi-sync (dev server), hibi-sign (release key)
└── main_darwin.go  # Wails window
```

Schema rules live in two places (Postgres and `desktop/syncsvc/rules.go`); see
[AGENTS.md](AGENTS.md). Design notes: [docs/PLAN.md](docs/PLAN.md).

## hibi for Mac

Open `hibi.dmg` and drag hibi to Applications. It isn't notarized, so the first
launch is blocked: **System Settings → Privacy & Security → Open Anyway**.

- **Updates** install themselves: "Update available" → **Restart**. They're signed, and a failed update keeps the old app.
- **Data:** `~/Library/Application Support/app.hibi.desktop/hibi.sqlite`. Updates never touch it; copy the folder while hibi is closed to back it up.
- **Uninstall:** delete hibi from Applications, plus that folder if you want the data gone.

## CI and releases

Every PR runs lint, typecheck, unit tests, the production build, the desktop
export check, Go tests, and a `db` job that applies all migrations to a fresh
Supabase and runs the integration tests. `main` requires the `ci` check.
Vercel deploys `main`; a `desktop-v<x.y.z>` tag publishes a Mac release.

Production runbook and the release process: [docs/OPERATIONS.md](docs/OPERATIONS.md).
