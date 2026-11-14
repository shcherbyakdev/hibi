"use client";

import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { generateNKeysBetween } from "fractional-indexing";
import type { BoardLayout } from "@/db/enums";
import type { Board, BoardColumn, Item } from "@/lib/sync/db";
import { useSync } from "@/lib/sync/provider";
import { bySortKey, isLive, keyBetween, keyForStep } from "@/features/items/model";
import { nextTone, type ToneKey } from "@/lib/tone";

export const DEFAULT_COLUMNS = ["To do", "Doing", "Done"];

export function useBoards(): Board[] | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (await db.boards.filter(isLive).toArray()).sort(bySortKey), [db]);
}

/** undefined = still reading; null = no such (live) board. */
export function useBoard(id: string): Board | null | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => {
    const b = await db.boards.get(id);
    return b && isLive(b) ? b : null;
  }, [db, id]);
}

export function useColumns(boardId: string): BoardColumn[] | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (await db.board_columns.where("board_id").equals(boardId).filter(isLive).toArray()).sort(bySortKey), [db, boardId]);
}

export function useBoardItems(boardId: string): Item[] | undefined {
  const { db } = useSync();
  return useLiveQuery(async () => (await db.items.where("board_id").equals(boardId).filter(isLive).toArray()).sort(bySortKey), [db, boardId]);
}

const nameOf = (s: string, max: number) => s.trim().slice(0, max);

export function useBoardActions() {
  const { db, mutations: m } = useSync();
  return useMemo(() => {
    const liveBoards = async () => (await db.boards.filter(isLive).toArray()).sort(bySortKey);
    const columnsOf = async (boardId: string) => (await db.board_columns.where("board_id").equals(boardId).filter(isLive).toArray()).sort(bySortKey);

    return {
      /** New board at the end of the sidebar, with To do / Doing / Done. */
      async createBoard(name: string, layout: BoardLayout = "kanban"): Promise<string | null> {
        const n = nameOf(name, 120);
        if (!n) return null;
        const existing = await liveBoards();
        const boardId = await m.insert("boards", {
          name: n,
          icon: nextTone(existing.map((b) => b.icon)), // the colour key (tone.ts)
          layout,
          sort_key: keyBetween(existing.at(-1)?.sort_key ?? null, null),
        });
        const keys = generateNKeysBetween(null, null, DEFAULT_COLUMNS.length);
        for (const [i, col] of DEFAULT_COLUMNS.entries()) await m.insert("board_columns", { board_id: boardId, name: col, sort_key: keys[i] });
        return boardId;
      },
      renameBoard(board: Board, name: string) {
        const n = nameOf(name, 120);
        if (n && n !== board.name) return m.update("boards", board.id, { name: n });
      },
      setLayout: (board: Board, layout: BoardLayout) => m.update("boards", board.id, { layout }),
      setTone: (board: Board, tone: ToneKey) => m.update("boards", board.id, { icon: tone }),
      /** Soft-deletes the board, its columns and its items (the UI confirms). */
      async deleteBoard(board: Board) {
        const [cols, items] = await Promise.all([columnsOf(board.id), db.items.where("board_id").equals(board.id).filter(isLive).toArray()]);
        for (const i of items) await m.remove("items", i.id);
        for (const c of cols) await m.remove("board_columns", c.id);
        await m.remove("boards", board.id);
      },

      async addColumn(boardId: string, name: string) {
        const n = nameOf(name, 80);
        if (!n) return;
        await m.insert("board_columns", { board_id: boardId, name: n, sort_key: keyBetween((await columnsOf(boardId)).at(-1)?.sort_key ?? null, null) });
      },
      renameColumn(col: BoardColumn, name: string) {
        const n = nameOf(name, 80);
        if (n && n !== col.name) return m.update("board_columns", col.id, { name: n });
      },
      /** One step left (-1) or right (+1). */
      async moveColumn(col: BoardColumn, dir: -1 | 1) {
        const cols = await columnsOf(col.board_id);
        const key = keyForStep(cols, cols.findIndex((c) => c.id === col.id), dir);
        if (key) await m.update("board_columns", col.id, { sort_key: key });
      },
      /** Its items stay on the board, under "No column" (the view groups any
          item whose column isn't live there — no item writes needed). */
      deleteColumn: (col: BoardColumn) => m.remove("board_columns", col.id),
    };
  }, [db, m]);
}
