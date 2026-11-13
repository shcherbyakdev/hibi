"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import type { Board } from "@/lib/sync/db";
import type { BoardLayout } from "@/db/enums";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";
import { DashboardSquare02Icon } from "@hugeicons/core-free-icons";
import { BOARD_TONES, boardTone, type BoardToneKey } from "../tone";
import { SEGMENTED_NAV_CLASS, segmentedItemClass } from "@/components/ui/segmented";
import { useBoardActions } from "../use-boards";

const LAYOUTS: Array<[BoardLayout, string]> = [
  ["list", "List"],
  ["kanban", "Board"],
];

/** List / Board, saved on the board (so every device opens it the same way). */
export function LayoutSwitch({ board }: { board: Board }) {
  const actions = useBoardActions();
  return (
    <div role="group" aria-label="Layout" className={SEGMENTED_NAV_CLASS}>
      {LAYOUTS.map(([value, name]) => (
        <button key={value} type="button" aria-pressed={board.layout === value} onClick={() => actions.setLayout(board, value)} className={segmentedItemClass(board.layout === value)}>
          {name}
        </button>
      ))}
    </div>
  );
}

export function BoardMenu({ board, taskCount }: { board: Board; taskCount: number }) {
  const actions = useBoardActions();
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Board options" render={<Button variant="ghost" size="icon-sm" />}>
          <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Colour</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              {(Object.keys(BOARD_TONES) as BoardToneKey[]).map((tone) => (
                <DropdownMenuItem key={tone} onClick={() => actions.setTone(board, tone)}>
                  <HugeiconsIcon icon={DashboardSquare02Icon} size={14} className={BOARD_TONES[tone]} />
                  <span className="capitalize">{tone}</span>
                  {boardTone(board) === BOARD_TONES[tone] ? <Check className="ml-auto size-3.5" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            Delete board
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete “{board.name}”?</DialogTitle>
            <DialogDescription>
              {taskCount
                ? `Its ${taskCount} task${taskCount === 1 ? "" : "s"} will be deleted too, including any planned in your day, week or month.`
                : "The board and its columns will be deleted."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                void actions.deleteBoard(board);
                router.push("/plan/day");
              }}
            >
              Delete board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
