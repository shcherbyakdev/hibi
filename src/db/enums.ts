// Allowed values for the text+CHECK columns. Dependency-free so the client
// bundle can import it without pulling in drizzle.
export const ITEM_STATUSES = ["todo", "doing", "done", "dropped"] as const;
export const PLAN_SCOPES = ["day", "week", "month"] as const;
export const BOARD_LAYOUTS = ["list", "kanban"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type PlanScope = (typeof PLAN_SCOPES)[number];
export type BoardLayout = (typeof BOARD_LAYOUTS)[number];
