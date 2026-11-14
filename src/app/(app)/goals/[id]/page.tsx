import { GoalView } from "@/features/goals/components/goal-view";

export default async function GoalPage({ params }: PageProps<"/goals/[id]">) {
  const { id } = await params;
  return <GoalView id={id} />;
}
