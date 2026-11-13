"use client";

import * as React from "react";
import { Board, type BoardGroup } from "@/components/board";
import type { Item } from "@/lib/sync/db";
import { ItemRow } from "@/features/items/components/item-row";
import { useItemActions } from "@/features/items/use-items";
import { parsePlaceId } from "@/features/items/model";

/** Board whose group ids are places ("day:…", "week:…", "inbox"): dropping
    into a group plans the item there. */
export function PlannerBoard({
  groups,
  today,
  children,
  showPlace = () => false,
  renderItem,
}: {
  groups: BoardGroup<Item>[];
  today: string;
  children: (list: (groupId: string, className?: string) => React.ReactNode) => React.ReactNode;
  showPlace?: (item: Item) => boolean;
  renderItem?: (item: Item, state: { overlay: boolean }) => React.ReactNode;
}) {
  const actions = useItemActions();
  return (
    <Board
      groups={groups}
      onMove={(item, groupId, prev, next) => {
        const place = parsePlaceId(groupId);
        if (place) void actions.move(item, place, prev, next);
      }}
      itemLabel={(i) => i.title}
      renderItem={renderItem ?? ((item, { overlay }) => <ItemRow item={item} today={today} overlay={overlay} showPlace={showPlace(item)} />)}
    >
      {children}
    </Board>
  );
}

export function GroupHeader({ children, count, accent }: { children: React.ReactNode; count?: number; accent?: boolean }) {
  return (
    <div className={`flex h-8 items-center gap-2 px-2 text-xs font-medium ${accent ? "text-danger" : "text-muted-foreground"}`}>
      {children}
      {count ? <span className="text-subtle tabular-nums">{count}</span> : null}
    </div>
  );
}
