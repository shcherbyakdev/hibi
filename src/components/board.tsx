"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type Row = { id: string; sort_key: string };
export type BoardGroup<T extends Row> = {
  id: string;
  items: T[];
  /** Can be dragged out of, not into (e.g. "Overdue"). */
  noDrop?: boolean;
};

/** Pointer drags start after 4px, and never from a text field or a control
    marked data-no-dnd — so typing, checkboxes and menus behave normally. */
/** Where the pointer is wins (grids: a wide row dragged out of a column must
    land in the cell under the cursor, not the one nearest its corners);
    between targets, fall back to corners. */
const pointerFirst: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : closestCorners(args);
};

class RowPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: React.PointerEvent) =>
        !(nativeEvent.target as HTMLElement).closest("input, textarea, [data-no-dnd]"),
    },
  ];
}

/* Groups of sortable rows (week days, kanban columns, one plain list). While
   dragging, the row moves between groups in local state so the target opens
   a gap; on drop, `onMove` gets the group and the neighbours' sort keys and
   the store writes one row. The caller lays out the page and places each
   group's list with `list(groupId)`, anywhere inside the board.
   ponytail: pointer only — keyboard moves go through each row's menu (and
   shortcuts in phase 6), not dnd-kit's KeyboardSensor. */
export function Board<T extends Row>({
  groups,
  onMove,
  renderItem,
  itemLabel,
  children,
}: {
  groups: BoardGroup<T>[];
  onMove: (item: T, groupId: string, prev: string | null, next: string | null) => void;
  renderItem: (item: T, state: { overlay: boolean }) => React.ReactNode;
  /** What screen readers hear for an item (never its id). */
  itemLabel: (item: T) => string;
  /** `className` styles the group's drop zone (e.g. flex-1 to fill a cell);
      `grid` lays its rows out as a grid (sorting animates in 2D). */
  children: (list: (groupId: string, className?: string, grid?: boolean) => React.ReactNode) => React.ReactNode;
}) {
  const [drag, setDrag] = React.useState<{ id: string; from: string; initial: Record<string, string[]>; order: Record<string, string[]> } | null>(null);
  const sensors = useSensors(useSensor(RowPointerSensor, { activationConstraint: { distance: 4 } }));

  const byId = React.useMemo(() => new Map(groups.flatMap((g) => g.items.map((i) => [i.id, i] as const))), [groups]);
  const order = drag?.order ?? Object.fromEntries(groups.map((g) => [g.id, g.items.map((i) => i.id)]));
  const noDrop = new Set(groups.filter((g) => g.noDrop).map((g) => g.id));
  const groupOf = (id: string, o = order) => (id in o ? id : Object.keys(o).find((g) => o[g].includes(id)));

  const onDragStart = ({ active }: DragStartEvent) => {
    const id = String(active.id);
    setDrag({ id, from: groupOf(id)!, initial: order, order });
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!drag || !over) return;
    const id = String(active.id);
    const from = groupOf(id, drag.order);
    const to = groupOf(String(over.id), drag.order);
    if (!from || !to || from === to || noDrop.has(to)) return;
    const target = drag.order[to].filter((x) => x !== id);
    const at = target.indexOf(String(over.id));
    target.splice(at < 0 ? target.length : at, 0, id);
    setDrag({ ...drag, order: { ...drag.order, [from]: drag.order[from].filter((x) => x !== id), [to]: target } });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const d = drag;
    setDrag(null);
    if (!d || !over) return;
    const id = String(active.id);
    const to = groupOf(id, d.order)!;
    // Reordering inside a no-drop group means nothing.
    if (to === d.from && noDrop.has(to)) return;
    let list = d.order[to];
    const overIdx = list.indexOf(String(over.id));
    if (overIdx >= 0) list = arrayMove(list, list.indexOf(id), overIdx);
    const idx = list.indexOf(id);
    const before = list[idx - 1] ?? null;
    const after = list[idx + 1] ?? null;
    if (to === d.from) {
      const was = d.initial[to];
      const at = was.indexOf(id);
      if ((was[at - 1] ?? null) === before && (was[at + 1] ?? null) === after) return; // dropped where it was
    }
    onMove(byId.get(id)!, to, before && byId.get(before)!.sort_key, after && byId.get(after)!.sort_key);
  };

  const dragged = drag ? byId.get(drag.id) : undefined;
  const name = (id: string | number) => {
    const item = byId.get(String(id));
    return item ? itemLabel(item) : "item";
  };
  const accessibility = {
    screenReaderInstructions: { draggable: "Drag with a pointer to move. To move with the keyboard, use the item's options menu." },
    announcements: {
      onDragStart: ({ active }: { active: { id: string | number } }) => `Picked up ${name(active.id)}.`,
      onDragOver: () => undefined,
      onDragEnd: ({ active }: { active: { id: string | number } }) => `Dropped ${name(active.id)}.`,
      onDragCancel: ({ active }: { active: { id: string | number } }) => `Cancelled moving ${name(active.id)}.`,
    },
  };

  const list = (groupId: string, className?: string, grid = false) => {
    const ids = order[groupId] ?? [];
    return (
      <DropList id={groupId} disabled={noDrop.has(groupId)} className={className}>
        <SortableContext items={ids} strategy={grid ? rectSortingStrategy : verticalListSortingStrategy}>
          {ids.map((id) => {
            const item = byId.get(id);
            return item ? (
              <SortableRow key={id} id={id}>
                {renderItem(item, { overlay: false })}
              </SortableRow>
            ) : null;
          })}
        </SortableContext>
      </DropList>
    );
  };

  return (
    <DndContext accessibility={accessibility} sensors={sensors} collisionDetection={pointerFirst} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
      {children(list)}
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {dragged ? renderItem(dragged, { overlay: true }) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** The group's own drop zone, so an empty group still accepts a row. */
function DropList({ id, disabled, className, children }: { id: string; disabled?: boolean; className?: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id, disabled });
  return (
    <div ref={setNodeRef} data-group={id} className={cn("flex min-h-9 flex-col", className)}>
      {children}
    </div>
  );
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // The row's own controls carry the semantics; the wrapper isn't a button.
      role={undefined}
      tabIndex={undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}
