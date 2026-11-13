"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import type { BoardColumn } from "@/lib/sync/db";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useBoardActions } from "../use-boards";
import { InlineName } from "./inline-name";
import { cn } from "@/lib/utils";

export function ColumnHeader({ column, count, first, last, className }: { column: BoardColumn | null; count: number; first: boolean; last: boolean; className?: string }) {
  const actions = useBoardActions();
  return (
    <header className={cn("group/col flex h-8 items-center gap-1.5 px-2 text-xs font-medium", className)}>
      {column ? <InlineName value={column.name} label={`column ${column.name}`} maxLength={80} onSave={(n) => actions.renameColumn(column, n)} /> : <span className="text-muted-foreground">No column</span>}
      <span className="text-subtle tabular-nums">{count || ""}</span>
      {column ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            data-no-dnd
            aria-label={`Options for column ${column.name}`}
            className="text-subtle hover:text-foreground focus-visible:ring-ring/40 ml-auto flex size-6 items-center justify-center rounded-md opacity-0 outline-none group-focus-within/col:opacity-100 group-hover/col:opacity-100 focus-visible:ring-2 data-popup-open:opacity-100"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem disabled={first} onClick={() => actions.moveColumn(column, -1)}>
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem disabled={last} onClick={() => actions.moveColumn(column, 1)}>
              Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => actions.deleteColumn(column)}>
              Delete column
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </header>
  );
}
