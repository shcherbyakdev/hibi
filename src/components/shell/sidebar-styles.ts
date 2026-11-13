/* Sidebar rows, Linear metrics: 28px tall, 8px radius, 13px/500 text, 14px
   icons. States are flat tints of the ink, not cards: hover a whisper,
   active a notch stronger with full-strength text — quiet in both themes.
   The focus ring is inset so it never bleeds past the row. */
export const itemClass =
  "group/nav flex h-7 w-full items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors duration-150 ease-strong outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring/60";
export const idleClass = "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground";
export const activeClass = "bg-foreground/[0.07] text-foreground";
/** Nav icons: subtle at rest, brighter with the row. */
export const iconClass = (active: boolean) => (active ? "text-foreground" : "text-subtle group-hover/nav:text-muted-foreground");
/** Section tags, Autumn-style: small uppercase mono. */
export const sectionLabelClass = "text-subtle flex h-6 items-center px-2 font-mono text-[11px] uppercase tracking-[0.06em]";
