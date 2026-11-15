# hibi Desktop — design (project 2 of 4)

Date: 2026-11-15. The roadmap is: 1 sync transport seam (shipped) → **2 hibi Desktop** → 3 phone pairing over Wi-Fi → 4 the address service (the "Plex trick").

## Intent

Let people who aren't technical run their own private hibi on their Mac, with no server, no Docker and no account. hibi already works local-first: every device keeps a full copy in IndexedDB and syncs through a transport (project 1). The desktop app replaces Supabase with a small sync service that runs inside the app. Project 3 then lets phones on the same Wi-Fi sync with that same service.

## What the user decided

- **Desktop app, for people who aren't technical.** "As simple as possible."
- **One language for the desktop: Go.** The user asked why there should be two languages, so it's Wails (all Go), not Tauri (Rust) plus Go.
- **macOS only for now.** One universal `.dmg` covering Apple Silicon and Intel.
- **Unsigned at first.** Apple signing and notarization come later; the code doesn't change, only a build step. The download page explains the one-time "Open Anyway" step.
- **Every install starts empty.** Importing data from the hosted site comes later.
- **The hosted site keeps running.** One codebase, two editions.
- **Phone sync is required, but in project 3.** It only needs to work on home Wi-Fi while the Mac is awake.
- **No app stores.** That's why the phone will use a PWA through the address service in project 4.
- **The repo becomes public** so GitHub Releases can serve downloads and updates. A history scan found no secrets (2026-11-15); the author email in commits will be public, which is accepted.

## Goals

1. Install: download `hibi.dmg`, drag it to Applications, launch (and click "Open Anyway" once). The app opens straight into the planner with no sign-in.
2. Every feature the hosted site has today works: planner (day/week/month), Inbox, goals (grid, weekly aim, list/board, notes), routines, time tracking, ⌘K, shortcuts, theme and week start.
3. Data lives in one local SQLite file under `~/Library/Application Support/<bundle id>/`. It survives updates and reinstalls.
4. Automatic updates from GitHub Releases through an updater of our own, written in Go (Wails has none built in; see "Releases and updates"). The app checks on launch and daily, and asks before restarting.
5. The built-in sync service passes the project 1 contract suite (`src/lib/sync/transport.contract.ts`) through a new HTTP transport.

## Non-goals (this project)

- Windows and Linux.
- Signing and notarization.
- Importing from the hosted site.
- Phones and other devices (project 3).
- HTTPS and the address service (project 4).
- Backups UI, multiple profiles or users, staying in the menu bar after the window closes (project 3 decides that).

## Anti-goals: this fails even if it works when

- **The first launch needs anything beyond the one Gatekeeper step:** a terminal, a sign-up, a setup wizard.
- **An update loses or corrupts local data.**
- **The hosted edition changes behaviour** or ships desktop code paths to its users (bundle size, auth).

## Architecture (my calls, open to the builder's judgement where noted)

```
hibi.app (Wails v2, all Go)
 ├─ Go: sync service (net/http + modernc.org/sqlite, pure Go) on 127.0.0.1:<port>
 │    ├─ GET  /…               → the static web UI (Next.js export)
 │    └─ /sync/…               → transport API (below)
 └─ WebView window → http://127.0.0.1:<port>/plan/day
        the existing client: Dexie + engine + HttpTransport → /sync/…
```

- **One server serves both the UI and the sync API.** Same origin, no CORS. `127.0.0.1` counts as a secure context, so `crypto.randomUUID`, `crypto.subtle` and IndexedDB all work. Project 3 can later expose the same server to phones.
- **The desktop window is just another client.** It keeps its IndexedDB copy and syncs through `HttpTransport`, exactly like a phone will. One sync model everywhere.
- **The code lives in one Go module under `desktop/`:**
  - a `sync` package: the service plus SQLite storage, with the pure-Go driver, so universal (arm64 + amd64) builds need no cgo
  - a small `cmd/hibi-sync` that starts it standalone, for the TS contract tests and CI
  - the Wails app (`main.go`), which starts the service on a goroutine, waits until it's ready, then opens the window
- **The window loads `http://127.0.0.1:<port>/`, not Wails' own asset scheme,** so the origin matches what phones will use and it's a known secure context. Wails JS bindings aren't needed: the updater and anything else app-level are plain HTTP endpoints on the same Go server. Wails is just the native window, menu and lifecycle. **Spike step 0 must confirm** two things on a real Mac:
  - the Wails webview can navigate to the loopback URL (App Transport Security: add `NSAllowsLocalNetworking` to Info.plist if needed)
  - IndexedDB persists across relaunches at that origin
- **Single instance:** Wails v2's `SingleInstanceLock` option, so a second launch focuses the first window instead of fighting over the port.
- **The port:** prefer a fixed one (so the IndexedDB origin stays stable, since IndexedDB is per origin) and fail loudly if it's taken. Changing the port would orphan the browser-side copy; that's acceptable because the server holds the truth, but the builder should keep the port fixed. Exact number: the builder's call.

### Sync API (HTTP mirror of `SyncTransport`)

| Transport | HTTP |
|---|---|
| `upsert(table, rows)` | `POST /sync/:table` with body `rows[]` → `204`, or `409 {code, message}` for a refused row (RowError). Anything else (5xx) → `TransientError`. |
| `get(table, id)` | `GET /sync/:table/:id` → `200 row` or `404`. |
| `pull(table, from, limit)` | `GET /sync/:table?since=…&limit=…` or `?after_synced_at=…&after_id=…&limit=…` → `200 rows[]`, ordered `(synced_at, id)`. |
| `subscribe(onChange, onReady)` | `GET /sync/events`, Server-Sent Events. Connecting means `onReady`; any `change` event means `onChange`. `EventSource` reconnects on its own and fires `open` again, which is `onReady` again. |

**Server rules,** which must match Supabase (they're already pinned by the contract, plus `transport.ts` docs):
- **Stamping:** `synced_at` is stamped at commit time from a clock that never goes backwards (`max(now, last + 1µs)`), and one batch shares one stamp.
- **Last-write-wins:** a row whose `updated_at` is older than the stored one is dropped silently (strict `<`).
- **All-or-nothing:** a batch is applied in one SQLite transaction.
- **Times:** compared as instants. Store `synced_at` as one fixed-width UTC text format, or as integer µs, and convert at the edges.
- **Refusals:** mirror the Postgres `CHECK` constraints and FKs so the engine's rejection path behaves the same. The list is in `src/db/schema/*.ts`: lengths, enums, ranges, the `items_plan_pair` and month-aligned rules, and the goal/routine/item/time-entry FKs. Refusal codes reuse the Postgres ones the engine already understands (`23514` for checks, `23503` for FKs).
- **Storage:** one table per synced table, with `id`, `updated_at` and `synced_at` as columns and the full row as JSON. The builder may promote other columns if checks need them.
- **Loopback is not private.** Any web page in the user's browser can send requests to `127.0.0.1:<port>`: "simple" no-cors POSTs, and DNS rebinding for reads. With no auth until project 3, every request must pass three guards (my call; they're cheap, don't touch the transport API, and are covered by service tests):
  1. `Host` must be exactly `127.0.0.1:<port>` or `localhost:<port>`, else 403. This defeats DNS rebinding.
  2. If an `Origin` header is present, it must be the service's own origin, else 403.
  3. `POST`/`PUT` must be `Content-Type: application/json`, else 415. That forces a CORS preflight, which the service never approves.

  The service binds `127.0.0.1` only. Project 3 adds device tokens before anything listens beyond loopback.
- **Keeping the two in step (my call):** add a table-driven **refusal fixture** to the contract suite: a list of bad rows per table with the expected code. It runs against both the Supabase and HTTP transports in CI, so a hosted migration that adds a rule fails the desktop's contract run until the service learns it, and vice versa. Add a note to `AGENTS.md`: a schema change touches both, plus the fixture.
- **The service's SQLite schema is versioned from day one** (numbered migrations, `PRAGMA user_version`), so updates can migrate local data. That covers the "an update must not lose data" anti-goal. The stamp clock is seeded at startup from `max(synced_at)`, so it stays monotonic across restarts.
- **No `user_id` filtering:** one user per install. Clients send the fixed `LOCAL_USER_ID` (a constant UUID), and the server stores whatever arrives.

### The web UI: one codebase, a desktop build

- **Edition switch:** `NEXT_PUBLIC_EDITION=desktop` at build time (`next build` with `output: "export"` only in that edition, from `next.config.ts`). The hosted build is unchanged.
- **The desktop edition drops:**
  - the `(auth)` routes, `/auth/confirm`, the proxy/middleware and server actions
  - Supabase clients
  - the `redirects`/`headers` config (not supported in export; the `/boards` redirect isn't needed on desktop)
- **The `(app)` layout's server-side `requireUser` becomes**, in the desktop edition, a client shell with:
  - `SyncProvider` using `LOCAL_USER_ID`, and `createHttpTransport(location.origin)` instead of the Supabase transport
  - **prefs (week start) stored in the sync service, not `localStorage`**, so project 3's phones get them: `GET`/`PUT /prefs` (a small JSON object, last-write-wins by `updated_at`), and a desktop `PrefsProvider` that reads it and refetches on the SSE `change` hint. Theme stays per device in `localStorage`, as today. The Settings page keeps theme and week start, and drops account and sign-out. (My call: it saves a `localStorage` → server migration in project 3.)
- **How:** two route-group layouts, or one layout that picks per edition; the builder's call. Constraint: no desktop code in the hosted bundle and no Supabase code in the desktop export (check with the build output).
- **Dynamic routes:** `/plan/[view]` takes known params (day/week/month). `/goals/[id]` can't be listed at build time. **This is the known risk.**
  - **Step 0** is a throwaway spike to prove an approach before the real work starts.
  - Candidates: export one placeholder page that reads the id on the client, with the Go server serving it for `/goals/*`; or use `/goals?id=` in the desktop edition only.
  - The rest of the app links to goals through one helper, so the URL shape is changed in one place.

### Releases and updates

- **CI:** a GitHub Actions workflow on tag `desktop-v*`, on a macOS runner (free for public repos):
  - `wails build -platform darwin/universal`, with the Next.js desktop export embedded in the binary
  - a `.dmg` (via `create-dmg` or `hdiutil`, the builder's call)
  - `hibi-<version>.app.zip` plus its Ed25519 signature, uploaded to a GitHub Release
  - `latest.json` with version, url, signature and notes
- **The updater (our own, in Go), as the user chose:**
  - **Check:** on launch and daily, fetch `latest.json` from the latest GitHub Release. If it's newer, the UI shows a toast "Update available — Restart".
  - **Install:** download the `.app.zip` to a temp dir and verify its Ed25519 signature with the public key compiled into the app (Go stdlib `crypto/ed25519`; a mismatch aborts). Unzip, then swap: rename the running bundle to `hibi.app.old`, move the new one into its place, relaunch, and delete the `.old` on the next start. **If any step fails, the old app stays** and the toast links to the release page for a manual download.
  - **Data is never inside the bundle** (Application Support), so an update can't touch it.
  - Downloads made by the app's own HTTP client carry no quarantine flag, so no second Gatekeeper prompt. If the app runs from outside `/Applications` (App Translocation), it offers the manual download instead of swapping.
  - The private signing key lives in a repo secret and in a file outside the repo.
  - Covered by Go tests: a good signature installs, a bad signature or truncated zip leaves the old app, and an interrupted swap recovers from `.old` on the next start.
- **README:** a "hibi for Mac" section with a download link, the "Open Anyway" steps (with a screenshot), and where the data file lives.
- **Version:** the app version comes from the tag; the hosted site stays unversioned.

## Testing

- **Go:** unit tests for stamping, last-write-wins, checks and FKs, the three request guards, the SQLite migrations, and the updater (above).
- **The contract suite runs against the real service:** a new `http-transport.integration.test.ts` starts the service binary on a temporary port with a temporary database file, then runs `describeTransportContract("http", …)`. The cross-user cases are N/A here (single user). The FK refusal case should be added to the contract now, because this server enforces FKs.
- **The engine end to end:** the engine unit tests from project 1 stay. One new integration test runs two "devices" (two Dexie databases with `HttpTransport`) against one service: an offline write, last-write-wins, and an FK-ordered push of a goal plus its item.
- **Builds:**
  - the desktop export builds in CI on every PR (cheap, Linux); the macOS app build only runs on tags
  - the hosted build keeps passing unchanged
- **Manual check on a real Mac:**
  - install the `.dmg` and do the Gatekeeper step
  - create goals, tasks and routines, quit, relaunch: the data is still there
  - update from version N to N+1: the data is still there
  - the planner and goal board work
  - reinstalling keeps the data

## Prerequisites (the user's machine)

- **Go 1.23+ and the Wails CLI** (`go install github.com/wailsapp/wails/v2/cmd/wails@<pinned>`); installing them needs the user's OK.
- **The Xcode license accepted:** `sudo xcodebuild -license accept`, which only the user can run.
- **The repo switched to public** before the first release. That's a manual step in GitHub settings, or `gh repo edit --visibility public` with the user's go-ahead.

## Left to the builder

- The port number and the bundle identifier (suggestion: `app.hibi.desktop`).
- How the `(app)` layout splits per edition.
- Which dynamic-route approach wins the spike.
- Go package layout inside `desktop/`, error handling, logging, and how JSON is stored.
- Whether SSE sends one `change` event per write or debounces them.
- The update-prompt UI: a toast with "Restart" is enough.
