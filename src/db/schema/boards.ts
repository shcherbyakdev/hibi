import { check, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { syncColumns } from "./sync";

import { BOARD_LAYOUTS } from "../enums";

export const boards = pgTable(
  "boards",
  {
    ...syncColumns(),
    name: text("name").notNull(),
    icon: text("icon"),
    layout: text("layout", { enum: BOARD_LAYOUTS }).notNull().default("list"),
    // Fractional index (fractional-indexing). Ordered client-side in byte
    // order; the server never sorts by it, so no "C" collation needed.
    sortKey: text("sort_key").notNull(),
  },
  (t) => [
    index("boards_user_synced_idx").on(t.userId, t.syncedAt),
    check("boards_name_len", sql`char_length(${t.name}) between 1 and 120`),
    check("boards_layout_valid", sql`${t.layout} in ('list', 'kanban')`),
  ],
);

export const boardColumns = pgTable(
  "board_columns",
  {
    ...syncColumns(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortKey: text("sort_key").notNull(),
  },
  (t) => [
    index("board_columns_user_synced_idx").on(t.userId, t.syncedAt),
    index("board_columns_board_id_idx").on(t.boardId),
    check("board_columns_name_len", sql`char_length(${t.name}) between 1 and 80`),
  ],
);
