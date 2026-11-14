# Fold Boards into Goals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One way to group tasks. Boards go away; a goal can show its tasks as a list or as a To do / Doing / Done board.

**Architecture:** Each existing board becomes a goal **with the same id**, so old `/boards/<id>` links redirect to `/goals/<id>`. Its tasks get `goal_id`, and their column maps to status. Then `boards`, `board_columns`, `items.board_id` and `items.column_id` are dropped. On the client, Dexie v6 strips the dropped fields from local rows, so pushes never send columns the server no longer has. The goal board reuses the generic DnD `components/board.tsx` with lanes keyed by status.

**Tech Stack:** as before.

**Spec:** the user approved this in chat (2026-11-14): "fold boards into goals", with the proposal:
- the sidebar lists goals where Boards were
- the goal page gets a List / Board switch
- Board columns are To do / Doing / Done, and drag changes status
- boards, custom columns, the Board field and board chips are removed
- the one production board becomes a goal and its task moves with it, then the board tables are dropped
- custom column names are dropped

This replaces `2026-11-14-boards-goals.md`, which was never built.

## Decisions (mine, inside that approval)

- **`goals.layout`** is `'list' | 'board'`, default `'list'`. It is saved per goal and synced. A migrated board keeps its layout (`kanban` → `board`).
- **Board lanes:**
  - **To do:** `todo`
  - **Doing:** `doing`
  - **Done:** `done` with `done_at` within the last 14 days, newest first. `ponytail:` older done tasks live in the grid and "Done recently".
  - **Not shown:** dropped tasks, and routine copies from past days (the `openSteps` rule).
- **Moving between lanes:**
  - Dragging a card between lanes sets the status. Moving into Done sets `done_at`; moving out of Done clears it.
  - Order within a lane is `sort_key`.
  - Each lane has a quick add that creates an **unplanned** task with that lane's status and the goal.
- **Inbox** stays "unplanned and no goal": goal tasks live on their goal, as board tasks did on their board.
- **Mapping a column to a status:** a column named `doing` (case-insensitive, trimmed) gives `doing` if the task was `todo`. A column named `done` gives `done`, with `done_at = coalesce(done_at, updated_at)`. Any other column keeps the status. A task that already has a goal keeps it; the board's goal assignment only fills in missing ones.
- **Routes and links:** `next.config.ts` redirects `/boards/:id` → `/goals/:id` (permanent). ⌘K's Boards group becomes a Goals group.
- **Shared code moves out of `features/boards`:**
  - `tone.ts` → `src/lib/tone.ts` (`TONES`, `toneClass`, `nextTone`; the stored keys stay the same)
  - `inline-name.tsx` → `src/components/shared/inline-name.tsx`
  - Then `features/boards/` is deleted.
- **Seed:** creates the goal "Side project" with a few tasks across the statuses, instead of a board.

## Global Constraints

- Follow `AGENTS.md`. No new dependencies.
- **Server migration order, all in one custom migration file:**
  1. add `goals.layout`
  2. copy boards into goals (same id, `updated_at = now()` so clients pull)
  3. update items (goal and status) with `updated_at = now()`
  4. drop `items.column_id` and `items.board_id`, then `board_columns`, then `boards`
- **Client:**
  - Dexie `version(6)`: `boards: null, board_columns: null` and an `upgrade` that deletes `board_id`/`column_id` from every item.
  - `SYNCED_TABLES` becomes `"goals", "routines", "items", "time_entries"`.
  - Stale outbox entries for removed tables are skipped and cleared by the existing push loop. Verify this in the Task 2 engine test.
- **Deploy:** run the production migration before pushing. Old open tabs fail to push until they reload; that's acceptable for one user, and their changes stay queued. The migration can't be undone, and the user approved it.
- `npm run verify` must pass at every commit.

## Review Focus

1. **A local item still carrying `board_id`** (an existing device) after the upgrade: the push succeeds with no PGRST204 retry loop. Pinned by the Task 2 Dexie upgrade test.
2. **A task in a "Done" column without `done_at`:** it gets one, so it counts in the grid. Pinned by the Task 2 migration check (SQL on the seeded board).
3. **A task already on a goal and a board:** it keeps its own goal. Same check.
4. **Dragging Done → To do:** `done_at` is cleared, so the grid cell empties. Pinned by the Task 3 `laneMove` test.
5. **Old `/boards/<id>` bookmark:** it lands on the goal. Covered by the Task 4 manual check.

---

### Task 1: Move shared bits out of features/boards

**Files:**
- Create `src/lib/tone.ts` (moved from `features/boards/tone.ts`, renamed `BOARD_TONES` → `TONES`, `boardTone` → `toneClass`, `BoardToneKey` → `ToneKey`).
- Move `tone.test.ts` alongside it.
- Create `src/components/shared/inline-name.tsx` (moved).
- Update every import.

- [ ] **Step 1: Move and rename.**
- [ ] **Step 2: Run** `npm run verify`. Expected: PASS. Same behaviour; the tone tests travel with the file.
- [ ] **Step 3: Commit** with the message `Move tone and InlineName out of boards`.

### Task 2: Server migration, schema and client removal

**Files:**
- Create `src/db/migrations/0011_fold_boards.sql` (custom; the order in Global Constraints).
- Modify `src/db/schema/goals.ts` (add `layout`, check `in ('list','board')`).
- Modify `items.ts` (remove `boardId`, `columnId` and their indexes).
- Delete `boards.ts`, and its export from `index.ts`.
- Modify `src/db/enums.ts` (`GOAL_LAYOUTS = ["list","board"]`; remove `BOARD_LAYOUTS`).
- Run `drizzle-kit generate` afterwards to confirm "No schema changes" (the snapshot matches).
- Modify `src/lib/sync/db.ts` (Dexie v6 with `upgrade`, types, `SYNCED_TABLES`).
- **Delete:**
  - `src/features/boards/`
  - `src/app/(app)/boards/`
  - `sidebar-boards` (from `sidebar-body.tsx`)
  - `BoardField` (from `item-sheet.tsx`)
  - `Spot`/`moveToBoard`/`moveToColumn`/the board branch of `lastKey` (from items `model.ts`/`use-items.ts`)
  - the `spot` param (from `QuickAdd`)
  - `showPlace` and the board bits from board-only code
  - the boards group in `command-menu.tsx`, temporarily; the goals group comes in Task 4
- Modify `use-items.ts` (`useInbox` = unplanned and `!goal_id`).
- Modify `next.config.ts` (the redirect).
- Modify `scripts/seed.ts` (a goal with tasks).
- Modify `src/lib/auth/next-path.test.ts` (use `/goals/abc`).
- **Tests:** `src/db/rls.integration.test.ts` (drop the board cases) and `src/lib/sync/engine.integration.test.ts`.

**Interfaces:** Produces `Goal.layout: "list" | "board"`; `Item` without `board_id`/`column_id`; `LocalDb` without `boards`/`board_columns`.

- [ ] **Step 1: Write the failing tests** (engine integration):
  - **"upgrades a v5 device":** open a raw `Dexie` named `test-legacy-<uid>` at version 5, using `LocalDb`'s v5 stores. Put an item with `board_id`/`column_id`, plus outbox entries `{table:"items",id}` and `{table:"boards",id:"x"}`. Close it, then open it as `LocalDb` (v6) with an engine. The item has no `board_id` key, the push succeeds (`rejected` empty, outbox empties), and the server has the item.
  - **RLS:** a goal with `layout: "kanban"` → `23514`; `layout: "board"` → OK.
- [ ] **Step 2: Run** `npm run test:integration`. Expected: FAIL.
- [ ] **Step 3: Check the migration on real data.**
  - Before applying 0011, the local db holds the seeded board: "Side project", 3 columns, items in To do/Doing/Done, after `db:reset` on the pre-change seed.
  - Add a test row for Review Focus 3 by SQL: an item with both a `goal_id` and a `board_id`.
  - Run `npm run db:migrate`. Then check by SQL:
    - a goal with the board's id, name and icon exists, with `layout = 'board'`
    - the items have `goal_id` = the board id
    - the item from the "Done" column has `status = 'done'` and non-null `done_at`
    - the item from the "Doing" column has `doing`
    - the pre-set `goal_id` item kept its goal
    - the `boards`/`board_columns` tables are gone
  - Then make the code changes, run `db:reset` with the new seed, and run `db:types`.
- [ ] **Step 4: Run** `npm run test:integration` and `npm run verify`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Fold boards into goals: migrate data, drop boards`.

### Task 3: Goal board view

**Files:**
- Modify `src/features/goals/model.ts` and its test:
  - `LANES = ["todo","doing","done"]`
  - `lanes(items, today): Record<"todo"|"doing"|"done", Item[]>`, using the lane rules above, sorted by `sort_key` (done: `done_at` desc).
  - `laneMove(item, lane: ItemStatus): Partial<Item>`, which returns `{status}` plus `done_at`: set to now when entering done, null when leaving it, unchanged otherwise.
- Modify `use-goals.ts` (`setLayout(goal, layout)`).
- Modify `goal-view.tsx`:
  - a List / Board segmented switch in `PageActions` (copy the old board `LayoutSwitch` look from git history: `SEGMENTED_NAV_CLASS`)
  - Board renders the lanes with `components/board.tsx` (`groups` = lanes; `onMove(item, lane, prev, next)` → `m.update` with `laneMove` + `sort_key`) and a `QuickAdd` per lane (unplanned, `goalId`, status)
  - the grid, weekly aim and Routines stay above both views
- `QuickAdd` gets `status?: ItemStatus`; `useItemActions().create` gets an options param `{ goalId?, status? }` that replaces the positional `goalId`. Update its callers.

- [ ] **Step 1: Write the failing tests.**
  - `lanes`: dropped tasks are excluded; a past routine copy is excluded; done older than 14 days is excluded; done is ordered newest first.
  - `laneMove`: todo → done sets `done_at`; done → todo gives `done_at: null`; doing → todo gives no `done_at` key.
- [ ] **Step 2: Run** `npx vitest run src/features/goals`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm run verify`. Expected: PASS.
- [ ] **Step 5: Commit** with the message `Goal board view (To do / Doing / Done)`.

### Task 4: Sidebar goals, ⌘K, docs

**Files:**
- Create `src/features/goals/components/sidebar-goals.tsx` (the old `sidebar-boards` behaviour: section "Goals", one row per goal with its tone square, `+` to create inline and open it). Mount it in `sidebar-body.tsx`.
- Modify `command-menu.tsx` (a Goals group, with the placeholder "Search tasks, goals, commands…").
- Modify `docs/PLAN.md`:
  - mark phase 5's boards and phase 11 as folded into goals
  - add "11. Boards folded into goals"
  - update the domain model and screens tables

- [ ] **Step 1: Write the code.**
- [ ] **Step 2: Run** `npm run verify`. Expected: PASS.
- [ ] **Step 3: Manual check** with `npm run dev`:
  - The sidebar lists goals; `+` creates one and opens it.
  - Switch the goal to Board. Drag To do → Done: the grid cell fills. Drag it back: it empties.
  - Quick add in Doing creates a doing task that's not in Today and not in Inbox.
  - An unplanned task without a goal is still in Inbox.
  - `/boards/<seeded-goal-id>` redirects to the goal.
  - ⌘K lists goals.
  - The layout choice survives a reload.
  - At 400px the board lanes scroll horizontally inside the page.
  - Delete any test rows afterwards.
- [ ] **Step 4: Commit** with the message `Sidebar and ⌘K list goals`.
