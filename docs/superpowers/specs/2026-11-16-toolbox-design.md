# Toolbox widget — design

## Intent

A toolbox: one panel of small focus tools that sits beside or over whatever
page you're on. Pomodoro is the first tool, and it's driven by tasks, not a
free-standing timer: you pick what to focus on from Today and start it right
there. Visual reference: the "Today / Focus time / 04:32" widget set (dark
cards, task list with ▶ and pomodoro dashes, big countdown with a tick ring).

## Goals

- One widget, user-chosen placement: **Docked** (a column beside the content)
  or **Floating** (a draggable card over it), or hidden.
- Start a pomodoro on a today task from the widget; see progress per task and
  for the day.
- Uses the existing time-tracking data — no schema change.

## Non-goals (this round)

- **Pop-out** over other apps (browser Document Picture-in-Picture, desktop
  mini window via Wails `WindowSetAlwaysOnTop` + resize). Next round.
- Editable focus goal, custom pomodoro/break lengths, break timer.
- Other tools. No tool registry — a second tool adds a section.
- Syncing the placement across devices.

## Anti-goals

- A second timer that can disagree with the top bar. The widget is a view of
  the same `time_entries` session `TimerProvider` already runs.
- Covering content in Docked mode.

## Approaches (picked: A)

- **A. One component, placement per device in localStorage.** Chosen: cheap,
  device-appropriate (laptop vs big monitor), no database change.
- B. Placement as a synced pref — touches Postgres + Go sync service +
  contract fixture for a setting that's usually per device. Rejected.
- C. Docked as an overlay `Sheet` — covers the page, so it's just a second
  floating mode. Rejected.

## Design

### Placement

- `src/features/toolbox/` — `use-toolbox.ts` (mode + floating position),
  `components/toolbox.tsx` (the card), `components/toolbox-host.tsx`
  (placement).
- State: `{ mode: "hidden" | "docked" | "floating", x, y }` in localStorage
  key `todo:toolbox`, read via `useSyncExternalStore` like `todo:paused-item`
  in `use-timer.tsx` (try/catch, in-tab event, `storage` event). Default
  hidden.
- Mounted once in `AppShell`:
  - **Docked:** a 320px column right of the content panel, on the
    `bg-sidebar` ground (mirrors the left sidebar), own vertical scroll.
    `md` and up only.
  - **Floating:** portal to `document.body`, `position: fixed`, drag by the
    header with pointer events (`setPointerCapture`), clamped to the viewport
    on drag end and on window resize, position saved on drag end. Shadow
    allowed (it's a floating thing). Below `md`, Docked renders as Floating.
- Toggles: top-bar button beside `TimerBar` (cycles via a small menu: Dock /
  Float / Hide), global shortcut **F** (toggle last visible mode ↔ hidden;
  free in `shortcuts.tsx`), ⌘K entries "Dock toolbox", "Float toolbox",
  "Hide toolbox". Header has a dock/float switch and a close button.

### Content (top to bottom)

1. **Today ↗ / + Add** — header links to `/plan/day`; Add opens an inline
   input that creates a day task for today (`parseQuickTitle`, existing item
   actions).
2. **Task list** — open tasks planned for today (`usePlanned("day", today)`
   filtered `isOpen`), list order. Each row: title, pomodoro dashes, and
   - the running task: live countdown + ⏸ (accent outline);
   - others: ▶ starts a **pomodoro** (`timer.start(id, { pomodoro: true })`).
   Clicking the title opens the item sheet.
3. **Timer** — big `clock()` countdown for the running pomodoro inside a
   rounded-square tick ring (60 SVG ticks; ticks fill clockwise with
   elapsed fraction). Buttons: **Reset** (end the current session, start a
   fresh pomodoro on the same task — partial time still counts) and
   **Pause/Resume**. A plain (non-pomodoro) timer shows its count-up with no
   ring progress. Idle: `25:00`, Resume offered if `pausedItemId`, otherwise
   "Pick a task" hint.
4. **Focus time** — sum of all sessions (plain + pomodoro) that started
   today, local time, live while running, e.g. `3h 50m`; "Goal: 4 hours"
   as a constant (`FOCUS_GOAL_SECONDS`, `ponytail:` comment — becomes a pref
   when someone wants it changed).

### Derived numbers (new, pure, tested in `features/time/model.ts`)

- `pomodorosDone(entries, itemId, dayStart, dayEnd, now)` — sessions on that
  item with `planned_seconds`, started in [dayStart, dayEnd), whose
  `sessionSeconds` reached `planned_seconds`.
- `focusSeconds(entries, dayStart, dayEnd, now)` — sum of `sessionSeconds`
  of sessions started in the day.
- Dashes: 4 slots, filled = done (capped visually); more than 4 shows `×n`.

### Look

Follows hibi's tokens, not the reference's orange: `primary`/`brand` blue for
running and progress, `--radius`, Geist Mono for clocks, uppercase mono
section labels, hairline cards. Ring and dashes respect
`prefers-reduced-motion` (no animated transitions, just state).

### Accessibility

Timer has `role="timer"` + label (as `TimerBar`); icon buttons have
`aria-label`s; floating card is a labelled `region`, focusable header,
Escape closes; drag is mouse/touch only — keyboard users switch to Docked.

## Constraints

- Next 16.4 / React 19.3 — client components only, read the local Next docs
  before using any Next API.
- Works in both editions (hosted + desktop static export) — nothing
  server-side.
- No new dependencies.

## Checks

- Unit: `pomodorosDone`, `focusSeconds` (incl. a session spanning midnight
  counts on its start day; running pomodoro capped at planned).
- Unit: viewport clamp for the floating position.
- Manual: dock/float/hide persist across reload; starting from the widget
  updates the top bar and the row pill; pomodoro end fills a dash.

## Calls made for you (correct any)

- ▶ in the widget starts a **pomodoro**, not a plain timer.
- Today list = today's day tasks only (no overdue, no week tasks).
- Reset = restart, keeping the partial session.
- Focus goal fixed at 4h.
- Shortcut **F**; default mode hidden.
- hibi blue instead of the reference's orange.

## Left to the builder

Exact spacing/sizes, tick ring geometry, menu component choice for the
top-bar toggle, empty-state copy.
