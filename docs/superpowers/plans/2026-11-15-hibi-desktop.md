# hibi Desktop Implementation Plan (project 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a macOS app (Wails, all Go) that runs hibi locally with no account. A Go sync service on loopback serves the web UI and the sync API and stores everything in SQLite; updates come from GitHub Releases through a signed updater of our own.

**Architecture:** see the spec. One Go module in `desktop/`:
- `sync`: the service and storage
- `update`: the updater
- `cmd/hibi-sync`: runs the service standalone
- `main.go`: the Wails app

The web UI is the existing Next.js app built with `NEXT_PUBLIC_EDITION=desktop` and `output: "export"`, then embedded into the Go binary. In the browser, the existing engine syncs through a new `HttpTransport`.

**Tech Stack:** Go 1.23+, Wails v2 (pinned), `modernc.org/sqlite` (pure Go), Next 16 static export, Vitest, GitHub Actions (macOS runner).

**Spec:** `docs/superpowers/specs/2026-11-15-hibi-desktop-design.md`. Read it first; its rules aren't repeated here.

## Global Constraints

- **The hosted edition is unchanged:** `npm run verify` and `npm run build` with no edition set behave as today, and the hosted bundle carries no desktop code.
- **The desktop export contains no Supabase code** (Task 4 greps the build).
- **The sync service binds `127.0.0.1` only.** Every request passes the three guards (Host, Origin, JSON content type).
- **Timestamps:** `synced_at` is written as fixed-width UTC text `2006-01-02T15:04:05.000000Z` (µs) and compared only after parsing the input to an instant.
- **Refusal codes:** `23514` for checks, `23503` for FKs, as a `409 {code, message}` body.
- **The SQLite schema is versioned with `PRAGMA user_version`** from v1.
- **Data path:** `~/Library/Application Support/app.hibi.desktop/hibi.sqlite`. Nothing inside the `.app` bundle is ever written.
- **No new npm dependencies.** Go dependencies are only `modernc.org/sqlite` and Wails.

## Review Focus

1. **A web page in the user's normal browser posting to `127.0.0.1:<port>/sync/items`** (no-cors, `text/plain`): refused with 415 and nothing written. Pinned by a Go guard test.
2. **A DNS-rebinding request** (`Host: evil.example:<port>`): 403. Pinned by a Go guard test.
3. **The app restarted with a clock that went backwards:** `synced_at` stays monotonic (seeded from `max(synced_at)`). Pinned by a Go store test.
4. **An update whose zip is truncated or wrongly signed:** the old app stays and launches. Pinned by Go updater tests.
5. **A child row pushed before its parent exists** (FK): `23503`, rejected by the engine, the queue keeps moving. Pinned by the contract FK case run against the HTTP transport.

---

### Task 0: Spike (throwaway; decides two unknowns)

No tests and no commit to `main`; it lives on `spike/desktop`, and only its findings are kept, in the ledger. Questions:
1. Can the Wails v2 window on macOS load `http://127.0.0.1:<port>/` served by our own Go `net/http`, and does IndexedDB persist across relaunches at that origin? Is `NSAllowsLocalNetworking` needed?
2. How can `/goals/[id]` work in the static export? Try (a): `generateStaticParams` returning `[{id:"_"}]`, the server serving `goals/_/index.html` for `/goals/*`, and the page reading the id from `useParams()`/`location` on the client, checked on a hard reload and on client-side navigation. If (a) fails, use (b): `/goals?id=` in the desktop edition via one `goalHref(id)` helper.

- [ ] **Step 1:** Write a minimal Next export (a page and a dynamic route) plus a ~40-line Wails app; run it with `wails dev`/`wails build`.
- [ ] **Step 2:** Record the answers as `Task 0: Ruling:` lines in the ledger. Task 3 implements the winning route approach, and Task 4 the plist setting.

### Task 1: Go sync service (storage, rules, HTTP, guards, SSE)

**Files:**
- Create: `desktop/go.mod` (module `github.com/shcherbyakdev/hibi/desktop`, `go 1.23`, Wails pinned at v2.17.1), `desktop/sync/{store.go,rules.go,server.go,events.go}`, `desktop/sync/*_test.go`, `desktop/cmd/hibi-sync/main.go`.

**Interfaces:**
- `sync.Open(path string) (*Store, error)`: runs migrations (v1 creates `goals`, `routines`, `items` and `time_entries` with `id TEXT PK, updated_at TEXT, synced_at TEXT, row JSON`, plus an index on `(synced_at, id)`, and a `prefs` table with a single row).
- `(*Store) Upsert(table string, rows []Row) *RowError`: one transaction. For each row: validate (rules.go); check the FKs against existing *or same-batch* parents. A stored row with an `updated_at` newer than the incoming one means skip; otherwise write with the batch stamp.
- `Get(table, id) (Row, bool, error)`
- `Pull(table string, since *time.Time, after *Keyset, limit int) ([]Row, error)`
- `Row = map[string]any`, `RowError{Code, Message string}`.
- `sync.Handler(store *Store, opts Options) http.Handler`, with `Options{Port int; UI fs.FS}`. Routes:
  - `POST /sync/{table}`, `GET /sync/{table}/{id}`, `GET /sync/{table}?…`, `GET /sync/events` (SSE)
  - `GET`/`PUT /prefs`
  - `GET /*`, which serves `UI` with the Task 0 route fallback, and `index.html` for `/`
- `cmd/hibi-sync`: flags `-port` (0 = random, print `listening on 127.0.0.1:<port>` to stdout) and `-db path`.

**Rules (rules.go), mirroring `src/db/schema/*.ts`** (lengths count characters, `utf8.RuneCountInString`):
- **goals:** `name` 1–120; `notes` ≤20000; `weekly_target` 1–7; `layout` in `list`/`board`.
- **routines:** `title` 1–500; `priority` 0–4; `days` 1–127; `goal_id` → goals.
- **items:**
  - `title` 1–500; `notes` ≤20000; `status` in `todo`/`doing`/`done`/`dropped`; `priority` 0–4
  - `plan_scope` in `day`/`week`/`month` or null; `plan_scope` and `plan_date` are both null or both set; a month plan has a `plan_date` day of 01
  - `goal_id` → goals, `routine_id` → routines
- **time_entries:** `item_id` → items (required); `ended_at` null or ≥ `started_at`; `planned_seconds` null or 60–14400.
- Required columns missing → `23502`.
- **FKs:** a reference to an id that doesn't exist in the parent table, even soft-deleted, → `23503`. A soft-deleted parent counts as existing, as in Postgres.

- [ ] **Step 1: Write the failing Go tests** (`go test ./...` from `desktop/`):
  - **Store:**
    - stamps one shared `synced_at` per batch, strictly increasing across batches
    - drops an older `updated_at`, and a tie overwrites
    - reopening a database whose `max(synced_at)` is in the future still stamps later than it
    - a batch with a bad row writes nothing
    - an FK to a missing parent gives 23503; parent plus child in one batch is accepted
    - `Pull` with `since` in ms `Z` form returns a row stamped later in the same millisecond (µs)
    - keyset paging through 5 rows with one stamp gives each row exactly once
    - `user_version` is 1 after `Open`
  - **Rules:** a table-driven test for each rule above, plus one valid row per table.
  - **Server:**
    - the guards: wrong `Host` → 403; foreign `Origin` → 403; `POST` with `text/plain` → 415; correct requests → 2xx
    - `409 {code}` on refusal, `404` on a missing `get`
    - SSE: a client receives `change` after another request's upsert
    - `/prefs` round-trip with last-write-wins
- [ ] **Step 2: Run** `cd desktop && go test ./...`. Expected: FAIL to compile.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `go test ./...` and `go vet ./...`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Desktop sync service (Go): store, rules, HTTP, guards, SSE`.

### Task 2: HttpTransport and the contract against the Go service

**Files:**
- Create: `src/lib/sync/http-transport.ts`, `src/lib/sync/http-transport.integration.test.ts`, `src/test/go-sync.ts` (starts `go run ./desktop/cmd/hibi-sync -port 0 -db <tmp>`, waits for the "listening" line, and returns the base URL plus `stop()`).
- Modify: `src/lib/sync/transport.contract.ts`. Add:
  - the **refusal fixture**: a table-driven `REFUSALS: Array<{table, row: (ids) => SyncRow, code}>` covering one rule per table plus one FK case (an item with a random `goal_id`). It runs for every transport that opts in with `setup().refusals: true`: Supabase and HTTP yes, memory no.
  - the FK case.
- Modify: `src/lib/sync/supabase-transport.integration.test.ts` (opt in to refusals).
- Modify: `AGENTS.md` (a note that a schema change touches Postgres, `desktop/sync/rules.go` and the refusal fixture).

**Interfaces:** `createHttpTransport(baseUrl: string): SyncTransport`:
- `fetch` sends JSON with `Content-Type: application/json`; `409` → `RowError`; any other non-2xx or network failure → `TransientError`.
- `subscribe` uses `EventSource(base + "/sync/events")`: `open` → `onReady`, a `change` message → `onChange`; `close()` on unsubscribe.
- In Node tests, `EventSource` exists globally in Node 24 (verify; if not, a 20-line fetch-stream reader in `src/test/`).

- [ ] **Step 1: Write the integration test:**
  - `describeTransportContract("http", …)` against `go-sync.ts`
  - plus an engine end-to-end test: two Dexie devices on one service, covering an offline write pushed on reconnect, a goal and its item pushed in FK order, and a refusal rejected while the queue moves on
- [ ] **Step 2: Run** `npm run test:integration -- http-transport`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** Run the full integration suite: Supabase must pass the new refusal fixture too. Any mismatch between `rules.go` and Postgres gets fixed in Go.
- [ ] **Step 4: Run** `npm run test:integration` and `npm run verify`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `HttpTransport passes the contract against the Go service`.

### Task 3: Desktop edition of the web app

**Files:**
- Modify: `next.config.ts`. When `NEXT_PUBLIC_EDITION === "desktop"`: `output: "export"`, `images.unoptimized`, no `headers()`/`redirects()`; otherwise unchanged.
- Create: `src/lib/edition.ts` (`IS_DESKTOP`, `LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001"`).
- Create: `src/lib/desktop-prefs.tsx` (`DesktopPrefsProvider`: `GET /prefs` on mount, refetch on the SSE hint, `setWeekStart` → `PUT`).
- Modify: `src/app/(app)/layout.tsx`. Split it so the desktop edition renders a client layout with:
  - `DesktopPrefsProvider`
  - `SyncProvider` with `userId={LOCAL_USER_ID}` and `transport={createHttpTransport(location.origin)}` (SyncProvider gets an optional `transport` prop; the hosted edition keeps the Supabase default)
  - `AppShell` with no email

  The exact mechanism (separate layout files picked by a build-time alias, or an `IS_DESKTOP` branch with the server parts dynamically excluded) is the builder's call, under the constraints below.
- Desktop export excludes the auth routes: `(auth)`, `auth/confirm` and the proxy. A route the export can't build is moved behind the edition check.
- Modify: `src/features/settings/settings.tsx` (desktop: week start via `DesktopPrefsProvider`, no account and no sign-out).
- Goal links: the `goalHref(id)` helper, plus the Task 0 route approach.
- Modify: `package.json` (script `build:desktop` = `NEXT_PUBLIC_EDITION=desktop next build`; output in `out/`).
- Modify: `.github/workflows/ci.yml` (job `desktop-export`: `npm run build:desktop` + grep `out/` for `supabase` → must be empty + `cd desktop && go test ./...`).

- [ ] **Step 1: Write the failing check:** `scripts/check-desktop-export.sh`. It runs `build:desktop` and fails if `out/` is missing `plan/day/index.html` or the goal route file, or if any file in `out/` contains `supabase.co`, `@supabase` or `auth/v1`.
- [ ] **Step 2: Run** it. Expected: FAIL (the export doesn't build).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the check, `npm run verify`, `npm run build` (hosted) and `npm run test:integration`. Expected: all PASS.
- [ ] **Step 5: Manual check:**
  - run `cmd/hibi-sync -port 47321` serving `out/`
  - open `http://127.0.0.1:47321/` in Chrome: the planner loads with no login
  - create a goal and a task, reload: they're still there
  - Settings week start round-trips
- [ ] **Step 6: Commit** with the message `Desktop edition of the web app (static export, local sync)`.

### Task 4: The Wails app

**Files:**
- Create: `desktop/main.go`, `desktop/wails.json`, `desktop/build/darwin/Info.plist` (with `NSAllowsLocalNetworking` if Task 0 said so), the app icon from `src/app/icon.svg` rendered to PNG/ICNS.
- `desktop/ui/` is the embed target (`//go:embed all:ui`); the build copies `out/` there. It's gitignored, except a placeholder `index.html` so `go test` compiles.

**Behaviour:**
1. Resolve the data dir and open the store.
2. Listen on `127.0.0.1:47321` (constant `Port`). If the port is busy, show a native error dialog "hibi is already running or port 47321 is in use" and quit.
3. Serve `sync.Handler`.
4. Open a Wails window with `SingleInstanceLock`, which navigates to `http://127.0.0.1:47321/plan/day`.
5. Standard macOS menu (App, Edit with copy/paste, Window).
6. ⌘Q closes the server cleanly (`Shutdown`) and the store.

- [ ] **Step 1:** Write `desktop/main_test.go` covering the pure helpers (`dataDir()` uses `os.UserConfigDir()` + `app.hibi.desktop`; a busy port returns a friendly error), then make it pass.
- [ ] **Step 2:** Add `npm run desktop:build`: `build:desktop` → copy `out/` into `desktop/ui/` → `wails build -platform darwin/universal`.
- [ ] **Step 3: Manual check on this Mac:**
  - open the built `hibi.app`; the planner appears
  - add data, ⌘Q, reopen: the data is still there
  - a second launch focuses the first window
  - `~/Library/Application Support/app.hibi.desktop/hibi.sqlite` exists
- [ ] **Step 4: Commit** with the message `hibi.app: Wails window on the local sync service`.

### Task 5: The updater

**Files:**
- Create: `desktop/update/{update.go,update_test.go}` and `desktop/cmd/hibi-sign/main.go` (`hibi-sign keygen`, `hibi-sign sign <file>`; Ed25519, base64).
- Modify: `desktop/sync/server.go`, adding:
  - `GET /app/update`, which returns `{available, version, notes}`
  - `POST /app/update`, which installs and relaunches; it's guarded like everything else
- Modify: the desktop web UI (a toast "Update available — Restart" that checks on load and every 24 h, and links to the release page on failure).

**Interfaces:**
- `update.Check(ctx, feedURL, current string) (*Release, error)`
- `update.Install(ctx, r *Release, appPath string, pub ed25519.PublicKey) error`:
  - download to a temp dir
  - verify the signature over the zip bytes
  - unzip to `<tmp>/hibi.app`
  - `os.Rename(appPath, appPath+".old")`, then `os.Rename(new, appPath)`; if the second step fails, rename `.old` back
- `update.Cleanup(appPath)` on startup: remove `.old` if `appPath` is valid; if `appPath` is missing and `.old` exists, restore it.
- `update.Relaunch(appPath)` = `open -n appPath`, then exit.
- If the app isn't under `/Applications` (translocated), `Install` returns `ErrNotInstalled` and the UI links to the release page.
- The public key is embedded via `-ldflags`.

- [ ] **Step 1: Write the failing tests:**
  - a good signature swaps the bundle
  - a bad signature or a truncated zip leaves the original untouched
  - a failed second rename restores the original
  - `Cleanup` restores when only `.old` exists
  - `Check` ignores the same or an older version (semver compare)
  - all against `httptest.Server` and temp dirs
- [ ] **Step 2: Run** `go test ./update`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `go test ./...`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Signed self-updater for hibi.app`.

### Task 6: Release pipeline and docs

**Files:**
- Create: `.github/workflows/desktop-release.yml` (on tag `desktop-v*`, `macos-latest`):
  - Node + Go + Wails pinned
  - `npm ci`, `npm run desktop:build` with `-ldflags` version = tag and public key
  - `ditto -c -k --keepParent hibi.app hibi-<v>.app.zip`
  - `hibi-sign sign` using the `HIBI_UPDATE_PRIVATE_KEY` secret
  - `hdiutil create` the dmg
  - write `latest.json`
  - `gh release create` with the dmg, zip, sig and `latest.json`
  - the feed URL is `https://github.com/shcherbyakdev/hibi/releases/latest/download/latest.json`
- Modify: `README.md`, adding a "hibi for Mac" section: the download link, the "Open Anyway" steps, the data location, and how to uninstall.
- Modify: `docs/PLAN.md` (a "12. hibi Desktop" paragraph).

- [ ] **Step 1:** Generate the key pair locally with `hibi-sign keygen`. The private key goes to `~/.config/hibi/update.key` (never committed); the public key is committed in `desktop/update/pubkey.txt`. **Ask the user** before adding the repo secret and before making the repo public (spec prerequisite).
- [ ] **Step 2:** Do a dry run of the workflow logic locally (`scripts/release-desktop-local.sh` runs the same steps without `gh release`). Expected: `dist/` contains the dmg, zip, sig and `latest.json`, and the zip's signature verifies.
- [ ] **Step 3: Commit** with the message `Desktop release pipeline and docs`.
- [ ] **Step 4 (with the user's go-ahead):**
  - make the repo public, add the secret, push tag `desktop-v0.1.0`, and watch the workflow
  - install from the Release on this Mac (Gatekeeper "Open Anyway")
  - push `desktop-v0.1.1` and confirm the in-app update keeps the data
