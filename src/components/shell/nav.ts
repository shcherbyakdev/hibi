import { Calendar03Icon, InboxIcon, Settings01Icon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

// One list for the sidebar and the ⌘K menu, so the two can't drift.
// `section` splits the sidebar Linear-style; boards join as their own
// section once they exist.
export type NavSection = "plan" | "account";
export const NAV_SECTIONS: readonly NavSection[] = ["plan", "account"];

export type NavItem = { href: string; label: string; icon: IconSvgElement; section: NavSection };

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/plan", label: "Planner", icon: Calendar03Icon, section: "plan" },
  { href: "/inbox", label: "Inbox", icon: InboxIcon, section: "plan" },
  { href: "/settings", label: "Settings", icon: Settings01Icon, section: "account" },
];

export function titleForPath(pathname: string): string {
  const hit = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  if (hit) return hit.label;
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "";
}
