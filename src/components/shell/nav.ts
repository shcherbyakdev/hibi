import { Calendar03Icon, InboxIcon, Settings01Icon, Target02Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

// One list for the sidebar and the ⌘K menu, so the two can't drift.
// `section` splits the sidebar Linear-style; boards join as their own
// section once they exist.
export type NavSection = "plan" | "account";
export const NAV_SECTIONS: readonly NavSection[] = ["plan", "account"];

/** `details`: the page is a list whose items open at href/<id>; those
    pages get a back link to it in the top bar. `ownSection`: the sidebar
    shows it as a section of its own (header + items) instead of a row. */
export type NavItem = { href: string; label: string; icon: IconSvgElement; section: NavSection; details?: true; ownSection?: true };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/plan", label: "Planner", icon: Calendar03Icon, section: "plan" },
  { href: "/inbox", label: "Inbox", icon: InboxIcon, section: "plan" },
  { href: "/goals", label: "Goals", icon: Target02Icon, section: "plan", details: true, ownSection: true },
  { href: "/settings", label: "Settings", icon: Settings01Icon, section: "account" },
];

export function titleForPath(pathname: string): string {
  const hit = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  if (hit) return hit.label;
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "";
}

/** The list page a detail page belongs to (/goals/<id> → Goals), if any. */
export function parentFor(pathname: string): NavItem | null {
  return NAV_ITEMS.find((i) => i.details && pathname.startsWith(i.href + "/")) ?? null;
}
