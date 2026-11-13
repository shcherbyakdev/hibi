export const PLAN_VIEWS = ["day", "week", "month"] as const;
export type PlanView = (typeof PLAN_VIEWS)[number];

export const isPlanView = (v: string): v is PlanView => (PLAN_VIEWS as readonly string[]).includes(v);
