"use client";

import { Board } from "@/components/board";
import { EmptyState } from "@/components/shared/empty-state";
import { PageActions } from "@/components/shell/page-actions";
import type { Item } from "@/lib/sync/db";
import { useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";
import { ItemRow } from "@/features/items/components/item-row";
import { QuickAdd } from "@/features/items/components/quick-add";
import { INBOX } from "@/features/items/model";
import { useItemActions } from "@/features/items/use-items";
import { useBoard, useBoardActions, useBoardItems, useColumns } from "../use-boards";
import { BoardMenu, LayoutSwitch } from "./board-menu";
import { ColumnHeader } from "./column-header";
import { AddNamed, InlineName } from "./inline-name";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardSquare02Icon } from "@hugeicons/core-free-icons";

/** Items whose column was deleted (or never set) gather here. */
const NONE = "none";

export function BoardView({ id }: { id: string }) {
  const board = useBoard(id);
  const columns = useColumns(id);
  const items = useBoardItems(id);
  const today = useToday();
  const boardActions = useBoardActions();
  const itemActions = useItemActions();
  if (board === undefined || !columns || !items || !today) return null;
  if (board === null) return <EmptyState title="Board not found">It may have been deleted, or it hasn&apos;t synced to this device yet.</EmptyState>;

  const live = new Set(columns.map((c) => c.id));
  const byColumn = new Map<string, Item[]>([...columns.map((c) => [c.id, []] as [string, Item[]]), [NONE, []]]);
  for (const i of items) byColumn.get(i.column_id && live.has(i.column_id) ? i.column_id : NONE)!.push(i);
  const lanes = [...columns.map((c) => ({ column: c, id: c.id })), ...(byColumn.get(NONE)!.length ? [{ column: null, id: NONE }] : [])];
  const groups = lanes.map((l) => ({ id: l.id, items: byColumn.get(l.id)! }));
  const kanban = board.layout === "kanban";
  const spot = (laneId: string) => ({ board_id: board.id, column_id: laneId === NONE ? null : laneId });

  return (
    <div className={cn("flex flex-col gap-5", kanban ? "min-h-0 flex-1" : "mx-auto w-full max-w-2xl")}>
      <PageActions>
        <LayoutSwitch board={board} />
        <BoardMenu board={board} taskCount={items.length} />
      </PageActions>
      <h2 className="flex items-center gap-2 text-[22px] font-normal tracking-[-0.03em]">
        <HugeiconsIcon icon={DashboardSquare02Icon} size={16} className="text-subtle shrink-0" />
        <InlineName value={board.name} label="board" maxLength={120} onSave={(n) => boardActions.renameBoard(board, n)} />
      </h2>

      <Board
        groups={groups}
        itemLabel={(i) => i.title}
        onMove={(item, laneId, prev, next) => void itemActions.moveToColumn(item, laneId === NONE ? null : laneId, prev, next)}
        renderItem={(item, { overlay }) =>
          kanban ? (
            <div className="py-0.5">
              {/* The drag copy draws its own lifted card (ItemRow overlay). */}
              {overlay ? (
                <ItemRow item={item} today={today} showPlace density="card" overlay />
              ) : (
                <div className="bg-card rounded-lg border shadow-xs">
                  <ItemRow item={item} today={today} showPlace density="card" />
                </div>
              )}
            </div>
          ) : (
            <ItemRow item={item} today={today} overlay={overlay} showPlace />
          )
        }
      >
        {(list) =>
          kanban ? (
            <div className="-mx-6 flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-6 pb-2">
              {lanes.map((l, i) => (
                <section key={l.id} className="bg-muted/60 flex max-h-full w-72 shrink-0 flex-col rounded-xl p-1">
                  {/* 11px: the name lines up with the card text (2px list inset + 1px card border + 8px row padding). */}
                  <ColumnHeader column={l.column} count={byColumn.get(l.id)!.length} first={i === 0} last={i === columns.length - 1} className="px-[11px]" />
                  <div className="min-h-0 overflow-y-auto px-0.5">{list(l.id)}</div>
                  <QuickAdd place={INBOX} spot={spot(l.id)} placeholder="Add" />
                </section>
              ))}
              <AddNamed label="Add column" className="w-72 shrink-0" onAdd={(n) => boardActions.addColumn(board.id, n)} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {lanes.map((l, i) => (
                <section key={l.id}>
                  <ColumnHeader column={l.column} count={byColumn.get(l.id)!.length} first={i === 0} last={i === columns.length - 1} />
                  {list(l.id)}
                  <QuickAdd place={INBOX} spot={spot(l.id)} />
                </section>
              ))}
              <AddNamed label="Add section" onAdd={(n) => boardActions.addColumn(board.id, n)} />
            </div>
          )
        }
      </Board>
    </div>
  );
}
