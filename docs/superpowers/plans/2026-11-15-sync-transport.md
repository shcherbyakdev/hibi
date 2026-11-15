# Sync Transport Seam Implementation Plan (Desktop project 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The sync engine talks to a small transport interface instead of Supabase directly, so the desktop edition can plug in its own sync service later. No user-visible change.

**Architecture:**
- `transport.ts` defines `SyncTransport`.
- `supabase-transport.ts` holds every PostgREST/Postgres/Realtime detail now in `engine.ts`.
- `memory-transport.ts` is an in-memory reference server.
- `transport.contract.ts` is one shared test suite that both transports must pass.
- `engine.ts` keeps all sync logic (outbox, FK order, LWW merge, rejection, backoff, phases) and loses every Supabase import.

**Tech Stack:** TypeScript, Dexie, supabase-js, Vitest (+ fake-indexeddb, already a dev dependency).

**Spec:** the user approved this in chat on 2026-11-15 ("project 1: sync core cleanup"). It is the first of four desktop projects: seam, desktop app, phone pairing, address service.

## Global Constraints

- No behaviour change on the hosted edition. All existing integration tests pass with only mechanical edits (constructor arguments).
- No new dependencies and no schema change.
- The engine imports nothing from `@supabase/*`.
- `npm run verify` must pass at every commit.

## Review Focus

1. **Keyset paging when several rows share one `synced_at`:** no duplicates, nothing skipped, on both transports. Pinned by contract test "pages a burst".
2. **An older `updated_at` write:** silently dropped, no error, on both transports. Pinned by contract test "drops older writes".
3. **A refused row in a batch:** the engine still finds it row by row, rejects only that row, and pushes the rest. Pinned by the engine unit test.
4. **A failed read during rejection:** never deletes the local row. The `get` error is transient; pinned by the engine unit test with a failing `get`.
5. **The realtime hint arriving before the subscription is ready:** the catch-up pull still happens. The Supabase transport calls `onReady` on SUBSCRIBED, and the existing integration tests cover it.

---

### Task 1: Interface, memory server, contract suite

**Files:**
- Create `src/lib/sync/transport.ts`.
- Create `src/lib/sync/memory-transport.ts`.
- Create `src/lib/sync/transport.contract.ts`.
- Test: `src/lib/sync/memory-transport.test.ts`.

**Interfaces (produces):**

```ts
export type SyncRow = { id: string; updated_at: string; synced_at: string } & Record<string, unknown>;
/** The server refused a row itself (constraint, permission): retrying can't help. */
export type RowError = { code: string; message: string };
/** Anything else (network, auth, 5xx): the engine backs off and retries. */
export class TransientError extends Error {}
export type PullFrom = { since: string } | { after: { synced_at: string; id: string } };

export interface SyncTransport {
  /** All-or-nothing batch; the server stamps synced_at and drops a row whose
      updated_at is older than the stored one. Returns null on success or the
      refusal; throws TransientError otherwise. */
  upsert(table: SyncedTable, rows: SyncRow[]): Promise<RowError | null>;
  /** The server's row, or null if it has none. Throws TransientError. */
  get(table: SyncedTable, id: string): Promise<SyncRow | null>;
  /** Rows with synced_at > since, or after the keyset (synced_at, id),
      ordered by (synced_at, id), at most `limit`. Throws TransientError. */
  pull(table: SyncedTable, from: PullFrom, limit: number): Promise<SyncRow[]>;
  /** Hints only: onChange when another client wrote; onReady each time the
      channel is (re)established. Returns unsubscribe. */
  subscribe(onChange: () => void, onReady: () => void): () => void;
}
```

`createMemoryServer({ refuse?: (table, row) => RowError | null })` returns `{ transport(): SyncTransport; rows(table): SyncRow[] }`:
- One shared store; every `transport()` is a client of it.
- `synced_at` comes from a strictly increasing server clock (ISO strings).
- Last-write-wins on `updated_at` uses `<`, matching `sync_stamp`.
- `subscribe` notifies every *other* client after an upsert, and calls `onReady` asynchronously right after subscribing.
- Test hooks: `failNext(op: "upsert" | "get" | "pull")` makes the next call throw `TransientError`.

**Contract suite:** `describeTransportContract(name, setup: () => Promise<{ a: SyncTransport; b: SyncTransport; refusedItem: SyncRow; newItem: () => SyncRow }>)`. The tests:
- **"stamps synced_at on the server":** upsert a row with `synced_at: "2000-01-01T00:00:00Z"`; pulling it gives a later `synced_at`.
- **"drops older writes":** upsert, then upsert the same id with an older `updated_at` and a different title. The result is `null`, and the title is unchanged.
- **"pulls since a cursor":** rows written after a cursor come back, and earlier ones don't.
- **"pages a burst":** 5 rows. Page through with `limit: 2` and keysets until a page is short. Every id is seen exactly once, in `(synced_at, id)` order. Use a cursor taken just before the writes.
- **"refuses a bad row":** `upsert([newItem(), refusedItem])` returns a `RowError` with a non-empty `code`, and neither row is stored (all-or-nothing).
- **"gets one row or null":** `get` returns the stored row, and null for a random id.
- **"hints other clients":** b subscribes, a upserts, and b's `onChange` fires (`waitFor`).

- [ ] **Step 1: Write** `transport.ts`, then the contract suite, then `memory-transport.test.ts`, which calls `describeTransportContract("memory", …)` with `refuse` rejecting items whose title is empty (`{ code: "23514", … }`).
- [ ] **Step 2: Run** `npx vitest run src/lib/sync/memory-transport`. Expected: FAIL, because `createMemoryServer` doesn't exist.
- [ ] **Step 3: Implement** `memory-transport.ts`.
- [ ] **Step 4: Run** the tests again. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Sync transport interface, memory server, contract suite`.

### Task 2: Supabase transport

**Files:**
- Create `src/lib/sync/supabase-transport.ts`.
- Test: `src/lib/sync/supabase-transport.integration.test.ts`.

**Interfaces:** `createSupabaseTransport(supabase: SupabaseClient, userId: string): SyncTransport`. Moved from `engine.ts`:
- `isRowError` (`/^2[23]/` or `42501` → `RowError`; any other error → `TransientError`)
- the untyped `from(table)` call
- the keyset `.or(...)` filter
- the Realtime channel: unique topic `sync:${userId}:${uuid}`, `postgres_changes` per table filtered by `user_id`, `onReady` on SUBSCRIBED, and `removeChannel` on unsubscribe
- `get` = `select("*").eq("id").maybeSingle()`
- `pull` = `select("*").order("synced_at").order("id").limit()` with `gt("synced_at", since)` or the keyset

- [ ] **Step 1: Write** the integration test: `describeTransportContract("supabase", …)`, with two clients of one signed-in user from `@/test/supabase`, and `refusedItem` = an item with an empty title.
- [ ] **Step 2: Run** `npm run test:integration -- supabase-transport`. Expected: FAIL, because the module isn't found.
- [ ] **Step 3: Implement** it, moving the code from `engine.ts` as listed. Leave `engine.ts` untouched until Task 3.
- [ ] **Step 4: Run** it again. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Supabase sync transport passes the contract`.

### Task 3: Engine on the transport

**Files:**
- Modify `src/lib/sync/engine.ts`:
  - `createSyncEngine({ db, transport, onReject })`; drop the `supabase`/`userId` params.
  - `Rejection.error: RowError`.
  - Keep `OVERLAP_MS`: the engine computes `since = cursor − 5s` and passes `{ since }`, or `{ after }` for later pages.
  - `TransientError` replaces the private `Retry`.
  - `start()` uses `transport.subscribe(() => sync({push:false}), onReadyCatchUp)`.
- Modify `src/lib/sync/provider.tsx` (`createSupabaseTransport(createClient(), userId)`).
- Modify `src/lib/sync/engine.integration.test.ts` (construct with the Supabase transport; the device's `fetchImpl` stays on its client).
- Test: `src/lib/sync/engine.test.ts`, a unit test using fake-indexeddb, the memory server and `createMutations`:
  - **"pushes offline writes on reconnect":** `failNext("upsert")`, then insert. The phase goes `offline`, then after `sync()` it's `idle` and the server has the row.
  - **"rejects only the bad row":** two inserts, one refused. The good row reaches the server, the bad one is dropped locally, and `onReject` is called once.
  - **"keeps the local row when the rejection read fails":** a refused insert plus `failNext("get")`. The local row is still there after the first run and is rejected on the retry.
  - **"pulls another client's write":** client b writes through its own transport; a's engine pulls it.
- Grep: `@supabase` must not appear in `engine.ts`.

- [ ] **Step 1: Write** `engine.test.ts`.
- [ ] **Step 2: Run** `npx vitest run src/lib/sync/engine.test`. Expected: FAIL, because the engine has no `transport` option.
- [ ] **Step 3: Refactor** `engine.ts`, then update the provider and the integration test.
- [ ] **Step 4: Run** `npm run verify` and `npm run test:integration`. Expected: all PASS (31 existing plus the new contract and engine tests).
- [ ] **Step 5: Commit** with the message `Sync engine talks to a transport, not Supabase`.
- [ ] **Step 6:** Add a short paragraph to `docs/PLAN.md` §2 ("Transport seam") and commit it with the step 5 commit.
