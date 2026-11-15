import { GoalRoute } from "@/features/goals/components/goal-route";

export default function GoalPage() {
  return <GoalRoute />;
}

/** The desktop export needs one prerendered page to serve for every goal. */
export function generateStaticParams() {
  return [{ id: "_" }];
}
