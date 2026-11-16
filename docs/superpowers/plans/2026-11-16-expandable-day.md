# Expandable Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a day in week or month view opens it in place. Its column widens and its row grows, and the other days shrink but stay in calendar order.

**Architecture:** One small module (`open-day.ts`) holds the open-day state hook and two pure helpers: the CSS track string, and the "was this a click on the cell background" guard. Month and week views use it and set `grid-template-columns` through a CSS variable, with a transition on it.

**Tech Stack:** Next 16 / React 19.3, Tailwind v4, lucide-react, vitest (node environment, so there are no component tests and the UI is checked by hand in the browser).

**Spec:** `docs/superpowers/specs/2026-11-16-expandable-day-design.md`

## Global Constraints

- Open column: `minmax(20rem, 3fr)`. Every other column: `minmax(0, 1fr)`.
- Transition: `transition-[grid-template-columns] duration-200 ease-out` plus `motion-reduce:transition-none`.
- Only one day open. No URL or storage persistence. No popup, drawer or overlay.
- A click on the cell background opens a day and never closes it. Clicks inside `button, input, [aria-roledescription]` are ignored (the same guard as month's double-click).
- ←/→ stay as period prev/next. Esc closes. Changing the period closes.
- Day number still goes to Day view, and the chip title still opens the item sheet.

## Review Focus

1. Double-click on an empty month cell opens the day **and** shows the inline add input. It must not open and then close. (Covered by the guard plus open-only clicks. Check by hand in Task 2.)
2. Dragging a task into a squeezed (narrow) day, and out of the open day, still reschedules it. (Check by hand in Tasks 2 and 3.)
3. Esc while typing in an input (QuickAdd, CellAdd) or with a task row focused must not also close the day: those already handle Esc. (Test in Task 1: skip when `defaultPrevented` or the target is editable.)
4. Navigate to the next month and back: no day is still open. (Test in Task 1 through `useOpenDay`'s period key. Check by hand.)
5. Open the last column (Sun/Sat): the grid must not overflow the page. Month scrolls sideways inside its own wrapper, as it already does. (Check by hand.)

---

### Task 1: `open-day.ts` (state hook + helpers)

**Files:**
- Create: `src/features/planner/open-day.ts`
- Test: `src/features/planner/open-day.test.ts`

**Interfaces:**
- Produces:
  - `openTracks(count: number, openIndex: number): string`: space-separated list of `count` tracks. The track at `openIndex` is `minmax(20rem,3fr)`, the rest are `minmax(0,1fr)`. `openIndex < 0` means none is open. Always an explicit list, never `repeat()`, so the transition can interpolate.
  - `isCellBackground(target: { closest(selector: string): unknown } | null): boolean`: true when `target?.closest("button, input, [aria-roledescription]")` is null.
  - `shouldCloseOnKey(e: { key: string; defaultPrevented: boolean; target: unknown }): boolean`: true only for `Escape`, when it isn't `defaultPrevented` and the target isn't an `HTMLInputElement`, `HTMLTextAreaElement` or contentEditable element. Guard the `instanceof` checks with `typeof HTMLElement !== "undefined"` so the function runs in node.
  - `useOpenDay(period: string): { open: string | null; setOpen: (d: string | null) => void }`. State is `{ period, day }`, and `open` is `day` only while `state.period === period`. Mounts a `window` `keydown` listener that calls `setOpen(null)` when `shouldCloseOnKey(e)`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { isCellBackground, openTracks, shouldCloseOnKey } from "./open-day";

const ONE = "minmax(0,1fr)", OPEN = "minmax(20rem,3fr)";

describe("openTracks", () => {
  it("is seven equal tracks when nothing is open", () => {
    expect(openTracks(7, -1)).toBe(Array(7).fill(ONE).join(" "));
  });
  it("widens only the open index", () => {
    expect(openTracks(7, 2).split(" ")).toEqual([ONE, ONE, OPEN, ONE, ONE, ONE, ONE]);
    expect(openTracks(7, 6).split(" ").at(-1)).toBe(OPEN);
  });
});

describe("isCellBackground", () => {
  it("ignores clicks inside interactive elements", () => {
    expect(isCellBackground({ closest: () => ({}) })).toBe(false);
    expect(isCellBackground({ closest: () => null })).toBe(true);
    expect(isCellBackground(null)).toBe(true);
  });
});

describe("shouldCloseOnKey", () => {
  it("closes on a plain Escape only", () => {
    expect(shouldCloseOnKey({ key: "Escape", defaultPrevented: false, target: null })).toBe(true);
    expect(shouldCloseOnKey({ key: "Escape", defaultPrevented: true, target: null })).toBe(false);
    expect(shouldCloseOnKey({ key: "ArrowLeft", defaultPrevented: false, target: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL** (module not found): `npx vitest run src/features/planner/open-day.test.ts`
- [ ] **Step 3: Implement the four exports per Interfaces** (`"use client"` isn't needed. The hook uses `useState` + `useEffect`.)
- [ ] **Step 4: Run, expect PASS**, plus `npm run typecheck` and `npm run lint` clean.
- [ ] **Step 5: Commit**

```bash
git add src/features/planner/open-day.ts src/features/planner/open-day.test.ts docs/superpowers
git commit -m "Planner: open-day state and grid track helpers"
```

### Task 2: Month view

**Files:**
- Modify: `src/features/planner/components/month-view.tsx`

**Interfaces:**
- Consumes: `useOpenDay(start)`, `openTracks(7, i)`, `isCellBackground(e.target as Element)` from Task 1.

- [ ] **Step 1: Wire state.** `const { open, setOpen } = useOpenDay(start)`, and `const openCol = open ? grid.flat().indexOf(open) % 7 : -1`.
- [ ] **Step 2: Grid template.** On the `grid min-w-[42rem] grid-cols-7` div: replace `grid-cols-7` with `grid-cols-(--month-cols)` and the transition classes from Global Constraints, then add `style={{ "--month-cols": openTracks(7, openCol) } as React.CSSProperties}`. While a day is open, the min width is `min-w-[56rem]` instead of `min-w-[42rem]`.
- [ ] **Step 3: Cell click.** On each cell: `onClick={(e) => isCellBackground(e.target as Element) && setOpen(d)}`. Switch the existing `onDoubleClick` guard to `isCellBackground` too (same selector, one source). Open cell gets `bg-brand/5` (outside-month cells keep `bg-muted/40` when closed).
- [ ] **Step 4: Expand/collapse button** in the cell header, before "+": lucide `Maximize2`/`Minimize2` (`size-3.5`), with the same classes as the "+" button (hover-revealed, focus-visible). On the open cell it stays visible. Props are `aria-expanded={open === d}`, `aria-label={\`${open === d ? "Collapse" : "Expand"} ${label.dayLong(d)}\`}`, and `onClick={() => setOpen(open === d ? null : d)}`. Wrap the "+" and this button in one `flex` group.
- [ ] **Step 5: Full rows in the open day.** `renderItem`: `item.plan_scope === "day" && !overlay && item.plan_date !== open ? <DayChip …/> : <ItemRow …/>`.
- [ ] **Step 6: Verify** `npm run typecheck && npm run lint && npm test`. In the browser (`/plan/month`):
  - click empty cell → column widens with animation, rows show full titles
  - click a different cell → it moves
  - Esc → closes
  - double-click empty cell → opens + input appears (Review Focus 1)
  - drag chip from a squeezed day into the open day and back (2)
  - open Sunday column (5)
  - → then ← → closed (4)
  - day number → Day view
  - chip title → sheet
  - typing in CellAdd then Esc closes only the input (3)
- [ ] **Step 7: Commit** `git commit -am "Month view: open a day in place"`

### Task 3: Week view

**Files:**
- Modify: `src/features/planner/components/week-view.tsx`

**Interfaces:**
- Consumes: `useOpenDay(start)`, `openTracks(7, i)`, `isCellBackground` from Task 1.

- [ ] **Step 1: Wire state.** `useOpenDay(start)` and `openCol = open ? days.indexOf(open) : -1`.
- [ ] **Step 2: Grid template.** The days grid keeps `grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]` below `xl`, and adds `xl:grid-cols-(--week-cols)` + transition classes, with `style={{ "--week-cols": openTracks(7, openCol) }}`. That means a 7-track explicit template from `xl` up (both closed and open, so the transition interpolates). Check in the browser that 7 columns fit at `xl` with the sidebar open. If they don't, use `2xl`.
- [ ] **Step 3: Narrow screens.** The open day's section gets `max-xl:col-span-full`.
- [ ] **Step 4: Cell click + header toggle.**
  - Section: `onClick={(e) => isCellBackground(e.target as Element) && setOpen(d)}`.
  - Header: turn the `<header>` content into a `<button type="button">` (full header width, keep `columnHeader` styling, add a focus-visible ring) with `aria-expanded={open === d}` and `onClick={() => setOpen(open === d ? null : d)}`.
  - Open section gets `bg-brand/5` (today already uses it). Make the open state also add `ring-1 ring-brand/30` so open-today is still distinguishable.
- [ ] **Step 5: Verify** `npm run typecheck && npm run lint && npm test`. In the browser (`/plan/week`) at ≥1280px and at phone width (≈390px):
  - click a day → it widens (wide) / takes a full row (phone)
  - header click toggles
  - Esc closes
  - drag a card between the bucket, a squeezed day and the open day (Review Focus 2)
  - ← → navigation closes (4)
  - Esc in QuickAdd only blurs the input (3)
- [ ] **Step 6: Commit** `git commit -am "Week view: open a day in place"`
