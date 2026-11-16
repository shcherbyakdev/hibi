# Expandable day in week / month view

## Why
In month view a day's tasks are cut to one line each, and in week view the
cards are squeezed into narrow columns. To read a day properly today you have
to leave the grid (Day view, or the item sheet). Goal: open a day **in place**
while the rest of the period stays visible.

## Goals / non-goals
- Goal: clicking a day widens its column (and its row grows) so tasks show in
  full; the other days shrink but keep calendar order. The resize animates.
- Goal: drag and drop keeps working into the open day and into the squeezed ones.
- Non-goal: no popup, drawer, overlay or new route.
- Non-goal: opening more than one day at a time. Remembering the open day
  across reloads or in the URL.
- Anti-goal: dates no longer lining up in columns (a broken calendar).

## Approaches
- **A. The open day's column grows (picked).** The open column becomes
  `minmax(20rem, 3fr)`, the others `minmax(0, 1fr)`. The grid stays a calendar.
- B. The open day spans a 2×2 or 3×2 block and the others flow around it.
  Rejected: days move out of their weekday columns.
- C. A full-width strip under that week. Rejected: it reads as a panel, close
  to the drawer the user ruled out.

## Behaviour
- **Open:** click a cell's empty area or its header. The guard is the one the
  month cell's double-click already uses: ignore clicks on `button, input,
  [aria-roledescription]`. Clicking an empty area only *opens* a day, it never
  closes one. That way a double-click still means "open + add task" instead of
  opening and immediately closing.
- **Close:** Esc, clicking the open day's header again, opening another day,
  or changing the period. ←/→ stay as period prev/next (`shortcuts.tsx`).
- Clicking the day number still goes to Day view, and clicking a chip title
  still opens the sheet.
- State: `const [open, setOpen] = useState<string | null>(null)` in each view.
  It is ignored when that date isn't on screen.
- Open cell gets `aria-expanded` on its header control. Respect
  `prefers-reduced-motion` (`motion-reduce:transition-none`).

## Month
- `grid-template-columns` is set from an inline style based on the open day's
  weekday index, with `transition-[grid-template-columns] duration-200
  ease-out`. The weekday header row sits in the same grid, so it follows.
- Rows already size to their tallest cell, so the open row grows on its own.
- `renderItem`: an item whose `plan_date === open` renders as `ItemRow`
  (the Day-view row: checkbox, priority, wrapped title, notes, time, timer).
  Every other item keeps `DayChip`.
- The open cell gets a subtle highlight (e.g. `bg-brand/5`, matching today in
  week view).

## Week
- **Wide screens, all 7 columns on one row:** switch from `auto-fit` to an
  explicit 7-track template while a day is open, using the same `3fr` rule
  and transition as month.
- **Narrow screens, where days wrap:** the open day gets `col-span-full`
  (a full row to itself). That is the natural shape on a phone.
- The cards (`ItemCard`) already show everything, so only the width changes.

## Left to the builder
- The breakpoint that decides "one row" vs "wrapped" in week view (match the
  point where 7 × 7.5rem fits).
- Whether month view's `min-w-[42rem]` grows while a day is open, so the
  squeezed columns stay readable (they already scroll sideways on small
  screens).
- One small test of the template-building function (open index → column
  string), if it ends up as a pure helper.
