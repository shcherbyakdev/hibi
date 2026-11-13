/* Linear sidebar metrics: 13px/500 items, 14px icons, 8px radius, 28px rows.
   The active row is lifted onto a card (hairline + small layered shadow). */
export const itemClass =
  "flex h-7 w-full items-center gap-2.5 rounded-[8px] border border-transparent px-2 text-[13px] font-medium transition-colors duration-150 ease-strong outline-none focus-visible:ring-2 focus-visible:ring-ring/40";
export const idleClass = "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground";
export const activeClass = "border-border bg-card text-foreground shadow-(--shadow-lift)";
export const sectionLabelClass = "text-subtle flex h-6 items-center px-2 text-xs font-medium";
