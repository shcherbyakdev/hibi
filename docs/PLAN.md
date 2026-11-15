# hibi — personal planner (Linear-fast)

Self-control planner for **day / week / month**, plus free-form **boards**
(list, kanban). Inherits pipline-app's stack, shell, tokens and infra; swaps
its server-roundtrip data flow for a **local-first** one so every interaction
is instant.

---

## 1. What we take from pipline-app (as-is)

| Area | pipline-app | Todo |
|---|---|---|
| Framework | Next 16.3 App Router, React 19.3, TS 6, Node 24 (`.nvmrc`, `engines`) | same |
| Styling | Tailwind v4 (`@tailwindcss/postcss`), `tw-animate-css`, `globals.css` token world (ground/ink/panel/hairline, `.dark`), `@custom-variant dark`, bare `border` = hairline | copy `globals.css` tokens, drop landing/widget/booking blocks; rename `kind-*` → priority/label colours |
| UI kit | shadcn `base-nova` on `@base-ui/react`, `cva`, `clsx`, `tailwind-merge`, `components/ui/*` (button, dialog, dropdown, popover, command, sheet, tooltip, checkbox, segmented-tabs, sonner…) | copy `components/ui/*` + `components.json` verbatim |
| Icons | Hugeicons (nav) + lucide | Hugeicons only |
| Fonts | Inter (opsz) + Geist Mono via `next/font` | same, drop Outfit/Newsreader |
| Shell | Linear-style `AppShell`: `bg-sidebar` ground, 236px sidebar, content in rounded hairline panel, top bar outside scroller, `nav.ts` single source for sidebar + ⌘K | copy `components/shell/*` + `command-menu.tsx`, new `nav.ts` |
| Feature layout | `src/features/<name>/{schema.ts (zod), queries.ts, actions.ts, components/}`, `lib/actions.ts` `ActionState` | same folders; `actions.ts` replaced by store mutations (§3) |
| DnD | `@dnd-kit/core` + `sortable` (sections panel) | same, for list reorder + kanban columns |
| Data | Supabase (Auth, Postgres, RLS) + Drizzle schema/migrations in `src/db`, `drizzle.config.ts` loopback guard | same; ports **+60** (`546xx`) so both stacks run together |
| Auth | `@supabase/ssr`, `src/proxy.ts` → `updateSession`, `(auth)` route group, `lib/auth/next-path.ts` | copy; drop orgs → rows owned by `user_id` |
| Env | `src/env.ts` + `env-schema.ts` (zod-validated) | copy, trimmed |
| Dev loop | `scripts/dev-preflight.ts` (Docker → supabase start → `.env.local` → migrate), `predev` hook, `db:reset`/`seed` | copy |
| Quality | ESLint 9 flat config, Vitest, `verify` = lint+typecheck+test | copy |
| CI/CD | `.github/workflows/ci.yml` (lint/typecheck/test/build/db-drift), `deploy.yml` (migrate → promote), Vercel `fra1` | copy, drop backup.yml at first |
| Docs | `DESIGN.md` (token + layout rules), `AGENTS.md` (Next 16 note) | trimmed `DESIGN.md`, same `AGENTS.md` |

**Dropped (YAGNI for a personal planner):** Stripe/billing, web-push, Inngest,
papaparse/CSV, Google sync, booking/embed/portal surfaces, flags, orgs/teams,
marketing landing, `next-intl` (add back if a second language is needed —
pipline's `i18n/` folder is the template).

---

## 2. The one big difference: local-first, not server actions

pipline-app mutates via Server Action → Supabase → `revalidatePath` → RSC
re-render. That's ~100–400 ms per click. Linear feels instant because the
**client owns the data**: in-memory store, persisted locally, synced in the
background.

```
 UI (React, useLiveQuery)
   │ read: synchronous from IndexedDB-backed store (0 network)
   │ write: mutate() → local row + outbox entry (same IDB txn)
   ▼
 Dexie (IndexedDB)  ── items, boards, columns, outbox, meta(cursor)
   │                         ▲
   │ push: drain outbox      │ pull: rows where updated_at > cursor
   ▼                         │      + Supabase Realtime (postgres_changes)
 Supabase Postgres (RLS: user_id = auth.uid())
```

- **Store:** `dexie` + `dexie-react-hooks` (`useLiveQuery`). Two small deps,
  replaces TanStack Query and any custom cache.
- **Writes:** one `mutate(table, id, patch)` helper: writes the row with
  `updated_at = now`, appends to `outbox`, kicks the sync loop. UI never awaits
  the network.
- **Push:** drain outbox in order via `supabase.from(t).upsert(rows)`; retry
  with backoff when offline; `online` event re-kicks.
- **Pull:** on load + on Realtime event, `select * where updated_at > cursor`
  → `bulkPut`. Conflict rule: **last-write-wins per row by `updated_at`**
  (single user, multiple devices — good enough; ponytail ceiling noted in code,
  upgrade to per-field LWW if edits collide).
- **Deletes:** soft (`deleted_at`) so they sync; purge job later if needed.
- **IDs:** `crypto.randomUUID()` client-side, so creates need no roundtrip.
- **Ordering:** `fractional-indexing` (`generateKeyBetween`) → `sort_key text`.
  DnD reorder writes exactly one row.
- **First paint:** shell is RSC (auth check in layout like pipline); data
  views are client components reading IDB — warm loads render with data
  instantly, no loading spinners after first sync.

**Built in phase 3** (`src/lib/sync/`): `db.ts` (Dexie, one db per user,
rows = server rows from generated `src/db/database.types.ts`), `mutate.ts`
(`insert/update/remove`, row + outbox in one transaction), `engine.ts`
(push/pull/realtime), `provider.tsx` (`SyncProvider`, `useSync`,
`useSyncStatus`). As built, beyond the sketch above:
- The outbox queues ids only; push sends each row's current state (ten edits = one upsert).
- A row Postgres refuses (constraint/RLS) is rejected — server copy restored or
  local row dropped, toast shown — so it can't block the queue. Anything else retries with backoff.
- Pull pages by `(synced_at, id)` keyset after a 5s overlap; Realtime only
  triggers pulls. A catch-up pull 3s after each subscribe plus a 60s heartbeat
  cover events Realtime drops.
- Tests: `src/lib/sync/engine.integration.test.ts` (two devices, offline, LWW,
  delete, rejection, empty-device fill).

**Transport seam (2026-11-15, desktop project 1 of 4).** The engine
(`engine.ts`) talks to a `SyncTransport` (`transport.ts`: upsert / get /
pull / subscribe, with `RowError` = refused, `TransientError` = retry), not
to Supabase. `supabase-transport.ts` is the hosted one (PostgREST, Postgres
error codes, Realtime); `memory-transport.ts` is an in-memory reference
server used by the engine's unit tests (`engine.test.ts`). Both pass one
contract suite (`transport.contract.ts`: server-stamped synced_at, older
writes dropped, cursor + keyset paging through a burst, all-or-nothing
refusal, get, best-effort hints) — the desktop's built-in sync service must
pass it too.

Alternative considered: Rocicorp **Zero** (Linear-style sync engine on
Postgres). Better at scale/conflicts, but adds a `zero-cache` server to run
and deploy. Not worth it for one user; revisit if sharing boards.

---

## 3. Domain model

Built in phase 2: `src/db/schema/*`, `src/db/migrations/0001_rls_sync.sql`.

```ts
// every table: id, user_id (default auth.uid()), created_at,
//              updated_at (client clock, LWW key), synced_at (server, pull cursor),
//              deleted_at (soft delete)
items          title, notes, status (todo|doing|done|dropped), priority (0-4),
               plan_scope (day|week|month)?, plan_date?, board_id?, column_id?,
               sort_key, done_at?
boards         name, icon?, layout (list|kanban), sort_key
board_columns  board_id, name, sort_key
```

- One `items` table powers everything: the planner is a **view by
  `plan_scope/plan_date`**, a board is a **view by `board_id`**. An item can
  be on a board *and* planned for Tuesday.
- **Constraints:** scope and date come as a pair; a month plan sits on the 1st
  (weeks are free: week start is a setting); status/priority/length checks.
- **`sync_stamp` trigger:** sets `synced_at = now()` and drops any UPDATE whose
  `updated_at` is older than the stored row's (server-side last-write-wins).
- **Indexes:** `(user_id, synced_at)` for pull, plus the FK columns. Dexie gets
  `[plan_scope+plan_date]`, `[board_id+column_id]`, `status` in phase 3.
- **RLS:** one owner policy per table, `(select auth.uid()) = user_id`;
  `authenticated` gets CRUD, `anon` nothing. Realtime publishes all three.
- **Tests:** `src/db/rls.integration.test.ts` (`npm run test:integration`).
- **Dates:** always local calendar dates, never `toISOString()` (UTC shifts
  midnight a day back east of GMT; the seed hit this).

---

## 4. Screens

| Route | View |
|---|---|
| `/plan/day` | Day list: the day's items + overdue carried in. Default post-login. |
| `/plan/week` | 7 day columns (Mon–Sun) + "This week" bucket. Drag between days = change `plan_date`. |
| `/plan/month` | Month grid of day cells + "This month" bucket. Click a day → day view. |

One **Planner** sidebar item; Day / Week / Month is a segmented switch in the top bar (`1/2/3`).

**Built in phase 4:** `features/planner/periods.ts` (local-date math, tested
in 3 timezones), `features/items/{model,use-items}.ts`, `components/board.tsx`
(generic dnd: `list(groupId)` render prop, pointer-first collisions, group
ids are places like `day:2026-11-13`), Day (Overdue group you drag out of),
Week (bucket + 7 columns, today scrolled into view), Month (grid of drop
targets + bucket), Inbox. The viewed date is `?d=`, changed by
`history.pushState`, so date stepping never hits the server. Each row's
options menu is the keyboard path for moving; drag is pointer-only for now.

> **Folded into goals in phase 11** — boards no longer exist; kept for history.

**Built in phase 5:** sidebar Boards section (inline create), `/boards/[id]`
with List / Board layouts (saved per board), inline rename for boards and
columns, column menu (move left/right, delete), "No column" group for items
whose column is gone (no item writes on column delete), board delete with a
confirm (soft-deletes its columns and tasks), boards in ⌘K. Same generic
`Board` as the planner. Dexie v2 adds a plain `board_id` index (the compound
one skipped null columns). An item has one `sort_key`, shared by its planner
list and board column.

**Built in phase 6:** `components/shortcuts.tsx` (one keydown listener;
task keys act on the focused row — rows are focus stops, so "selection" is
browser focus; `?` lists them), task details sheet (`item-sheet.tsx`: status,
priority, plan via native select + date input normalised to the period,
board/column, autosaving notes), delete with Undo toast, ⌘K task search
(local substring match) and actions, priority icons, Settings (theme; week
start saved in Supabase `user_metadata`, parsed server-side in
`lib/prefs-data.ts`), last planner view remembered per device. Week buckets
query a 7-day range so tasks dated under the other week-start still show.
| `/inbox` | Unplanned items (no scope, no board). Quick capture lands here. |
| ~~`/boards/[id]`~~ (phase 11: redirects to `/goals/[id]`) | `layout=list`: sortable list, grouped by column. `layout=kanban`: columns side by side, dnd across. Toggle with segmented tabs. |
| `/settings` | Theme, week start, sign out. |

Shared bits: `ItemRow` (checkbox, title inline-edit, priority, plan chip),
`ItemDetail` sheet (notes, scope picker), `Board` (generic dnd container used
by week view *and* kanban — one component, different grouping fn).

**Keyboard (Linear-style):** `C` new item, `⌘K` command menu (nav + actions +
item search over IDB), `J/K` move, `X` toggle done, `1/2/3` → day/week/month,
`T`/`W`/`M` plan selected for today/this week/this month, `⌫` delete. One
`useHotkeys` hook (~30 lines, no dep).

---

## 5. File layout

```
src/
  app/
    (auth)/login, signup, …          ← copied
    (app)/layout.tsx                 ← requireUser + AppShell + SyncProvider
    (app)/today|week|month|inbox|boards/[id]|settings/page.tsx
    globals.css, layout.tsx
  components/ui/*  shell/*  command-menu.tsx   ← copied
  db/schema/{items,boards}.ts  db/migrations/  db/rls/
  features/
    planner/   periods.ts (+test), components/{day,week,month}-view.tsx
    boards/    components/{board,list-view,kanban-view,column}.tsx
    items/     schema.ts (zod), components/{item-row,item-detail,quick-add}.tsx
  lib/
    sync/      db.ts (Dexie schema), mutate.ts, sync.ts (push/pull/realtime), sync.test.ts
    supabase/  auth/  utils.ts  hotkeys.ts    ← mostly copied
  proxy.ts  env.ts
```

---

## 6. Phases

1. **Scaffold (copy infra).** `create-next-app` → overwrite with pipline's
   `package.json` deps (trimmed), tsconfig, eslint, postcss, vitest,
   components.json, `.nvmrc`, `globals.css` tokens, fonts, `components/ui`,
   shell, env, proxy, supabase lib, auth pages, dev-preflight, `supabase init`
   on ports 546xx. ✅ when `npm run dev` boots to an empty shell behind login.
2. **Schema + RLS.** Drizzle tables, migration, RLS policies, realtime
   publication, seed user. ✅ `db:reset` works; RLS integration test (copy
   pipline's `*.rls.integration.test.ts` pattern).
3. **Sync layer.** Dexie schema, `mutate`, outbox push, pull + realtime,
   `SyncProvider`, status dot in top bar. ✅ test: create offline → reconnect
   → row in Postgres; edit on device B appears on A.
4. **Planner.** `periods.ts` (startOfWeek/month, overdue), Today, Week (dnd
   between days), Month, Inbox, quick-add. ✅ plan an item day→week→month and
   back without a spinner.
5. **Boards.** Board CRUD in sidebar, list + kanban layouts, column CRUD, dnd
   with fractional keys. ✅ reorder persists across reload and devices.
6. **Speed + polish.** Hotkeys, ⌘K item search, item detail sheet, dark mode,
   empty states, motion per pipline's `--ease-strong` rules.
7. **Time tracking.** Timer and 25-min pomodoro per task; pause and continue
   later (across reloads and devices); tracked total per task.
   Built: `time_entries` table (one row per session; running while
   `ended_at` is null; `planned_seconds` marks a pomodoro), same RLS/sync as
   the rest, Dexie v3. `features/time/model.ts` (tested): a pomodoro counts at
   most its length and closes at exactly start + 25m even if the app was
   closed; two timers running (two devices) → the newest wins, the older
   ends where it began. UI: top-bar timer (live total or countdown ring, tab
   title mirrors it, Resume after pause), row play button + total, Time
   section in the details panel (sessions, delete), S / P shortcuts, ⌘K
   pause/resume. Pomodoro end: toast, plus a browser notification when the
   tab is hidden and permission was granted (asked on first pomodoro start).
   Priority (0 none, 1 urgent … 4 low) as signal bars: three ascending
   bars, lit count = level (high 3, medium 2, low 1) in orange, urgent all
   three in red (`--priority`, `--priority-urgent`). (Briefly Jira chevrons;
   switched app-wide when Today went minimal.)
   Visible control first: a picker right after each row's checkbox (faint
   until hover when unset) and one beside quick add while typing. Extras:
   0–4 on a focused task, `!1`–`!4` in the title (`parseQuickTitle`, tested),
   the row menu, the details panel. Lists stay in manual order.
   Row composition (`item-row.tsx`): two densities. "list" = one line
   (checkbox · priority · title · notes/time/plan); "card" (week columns,
   kanban) = wrapping title with a metadata line under it. Hover actions
   (▶/⏸, ⋯) overlay the right edge and never take layout space; in list rows
   the metadata fades out while they show (no half-covered text). Done
   tasks' priority is muted. Today uses a third, "minimal" density: 44px
   rows on hairline dividers, 14px titles, a lighter checkbox, flat hover.
   Sidebar (`sidebar-styles.ts`): flat ink tints instead of lifted cards
   (hover 4%, active 7% + full-strength text), inset focus ring; the
   new-board input is styled as the row it becomes. Boards have a colour from the accent family (`tone.ts`, stored in `boards.icon`, least-used for new boards, Colour submenu), shown on the board icon only.
   **Visual language → Autumn (useautumn.com), read off the live site:**
   Geist + Geist Mono; neutral black/grey palette (dark: #000 sidebar,
   #0a0a0a panel, 10%-white hairlines; light derived: white, #171717 ink);
   one violet (#7c3aed solid primary — white on it holds AA; #9564ff accent
   at night); square corners (`--radius` 2px, no pills); flat — no shadows
   except floating things; small uppercase mono for section labels, field
   labels, dates and times; two-tone light headings ("Today" ink + date
   grey, 22px/400). Round task checkboxes kept on purpose.
   **Brand → hibi** (日々, "day after day"). Logo (`components/brand/hibi-logo.tsx`):
   the smile-and-dot mark redrawn as SVG from the brand artwork in its own
   coordinates, lightened (dot r 44, stroke 54; source 60/79), minimal after
   "dose" (logosystem.co): no tile, symbol sized to the letters. Mark = logo
   blue `primary` #4858fa in both themes; wordmark = Outfit 500 (brand-only
   font, round i-dots echo the mark), ink. Palette, unified to three roles: neutrals; one blue (logo, checked box, today, running timer, focus, primary actions — `primary` exact, `brand` the lifted tint/text variant at night); one red (`destructive`: overdue, urgent priority, delete, errors). Plus a small accent family (`--tone-*`: violet, green, teal, amber, rose) at equal OKLCH lightness/chroma per theme, so they read as one set — used only for board colours and high priority (amber). Priority: urgent red, high amber, medium/low ink. Unused tokens stay deleted. Alignment: sidebar logo on the nav grid (mark in
   the icon column, wordmark at the label line), Today heading on the rows,
   kanban column names on the card text; every centred-column page (Today, Inbox, board list, Settings) starts its text on one line (12px inset, same minimal rows); filled buttons paint their full border box so they match inputs; column names use the shared uppercase-mono label style. Favicon `app/icon.svg`. Internal
   names (folder, Dexie db `todo-<user>`, storage keys) stay `todo` on
   purpose: renaming the local db would drop unsynced changes.
8. **Ship.** Done before infra: CI (`.github/workflows/ci.yml`: lint, typecheck,
   unit, build, db job with migrations from empty + drift check + integration
   tests on a throwaway Supabase); production env checks (`APP_ENV=production`
   refuses a missing/local/non-https app URL or a local Supabase — build
   fails closed); sign-out pushes unsynced changes, then deletes the device's
   IndexedDB copy + `todo:*` keys (asks first if changes can't be pushed) and
   ends only this session (`scope: "local"`); "Forgot password?" switches to
   the email link. Remaining: GitHub repo, Supabase prod project (site URL,
   redirects, migrations, SMTP), Vercel project `fra1` + deploy workflow.

9. **Goals.** Built: `goals` table (name, notes, tone key in `icon`,
   `weekly_target` 1–7) + `items.goal_id` (`on delete set null`), same
   RLS/sync as the rest, Dexie v4 (`goal_id` index). Progress is derived,
   never stored: `features/goals/model.ts` (tested, incl. a Tokyo-TZ case)
   counts a goal's tasks by the local day of `done_at` → GitHub-style grid
   (5 levels in the goal's tone), streak (an empty today doesn't break it),
   days done this week vs target. `/goals` lists goals with 20 weeks;
   `/goals/[id]` has 53 weeks, rename/colour/target/notes, "Add a step for
   today" (a day task already linked), open and recently done tasks.
   Linking elsewhere: Goal field in the task sheet; linked rows show a tone
   dot. Deleting a goal unlinks its tasks (they stay). Plan:
   `docs/superpowers/plans/2026-11-14-goals.md`.

10. **Recurring steps (routines).** Built: `routines` table (title,
   priority, goal_id?, `days` weekday bitmask, bit 0 = Sunday, 127 = every
   day) + `items.routine_id`, Dexie v5. `features/routines/`: the client
   makes only **today's** copy of each due routine (`ensureToday`, run by
   `RoutineRunner` after this session's first sync or when offline, at
   midnight, and on routine edits). Copies get an id derived from
   (routine, date) — two devices make one row — and `updated_at` =
   2000-01-01, so a real edit always wins LWW (a lagging device can't
   un-tick). A deleted copy = skipped day. Routine copies never show as
   Overdue. UI: Routines section on a goal (day picker, rename, delete),
   Repeat field in the task sheet (turns a task into a routine; Never
   stops it), repeat icon on copies while the routine runs. Deleting a
   goal deletes its routines. Plan: `docs/superpowers/plans/2026-11-14-recurring-steps.md`.

11. **Boards folded into goals.** One way to group tasks. Migration
   `0011_fold_boards`: every board became a goal with the same id
   (`/boards/:id` redirects), its tasks joined the goal and their column
   became a status (Doing → doing, Done → done with a done_at); then
   `boards`, `board_columns`, `items.board_id/column_id` were dropped.
   Dexie v6 strips the gone fields from local items so upgraded devices
   never push missing columns. `goals.layout` = list | board: Board shows
   To do / Doing / Done (Done = last 14 days); dragging between lanes sets
   status (done_at follows, so the grid does); each lane's quick add makes
   an unplanned goal task. Inbox = unplanned and no goal. Sidebar lists
   goals (section header → /goals), ⌘K searches goals. Tone and InlineName
   moved to `src/lib/tone.ts` / `components/shared`. Plan:
   `docs/superpowers/plans/2026-11-14-fold-boards-into-goals.md`.
12. **hibi Desktop.** A Mac app with no account: a Wails window on a Go
   sync service (`desktop/syncsvc`) that serves the static desktop export
   (`NEXT_PUBLIC_EDITION=desktop`) and the sync API on `127.0.0.1:47321`,
   storing everything in one SQLite file in Application Support. The same
   `SyncTransport` contract runs against Supabase and the Go service, so
   the rules in `rules.go` can't drift from Postgres. Requests pass Host,
   Origin and JSON guards plus a per-launch token cookie. Updates are our
   own: `latest.json` from the latest GitHub Release, an Ed25519-signed
   `.app.zip` swapped in place with rollback. Releases: push tag
   `desktop-v<x.y.z>` (`.github/workflows/desktop-release.yml` runs
   `scripts/release-desktop.sh`). Spec and plan:
   `docs/superpowers/specs/2026-11-15-hibi-desktop-design.md`,
   `docs/superpowers/plans/2026-11-15-hibi-desktop.md`.

Later, not now: custom goal columns (stages), monthly / interval routines, recurring items (pipline has `features/recurrence`), weekly
review/stats, labels, calendar layout for boards, PWA offline install.

---

## 7. Open questions (defaults chosen)

- **Sync engine:** hand-rolled Dexie + Supabase (default) vs Zero.
- **Overdue handling:** auto-carry into Today as a separate "Overdue" group
  (default) vs auto-reschedule.
- **Week starts** Monday (default, setting in `/settings`).
- **i18n:** English only (default).
