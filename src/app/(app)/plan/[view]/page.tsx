import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageActions } from "@/components/shell/page-actions";
import { PlanViewSwitch } from "@/features/planner/view-switch";
import { isPlanView } from "@/features/planner/views";
import { Planner } from "@/features/planner/components/planner";

export default async function PlanPage({ params }: PageProps<"/plan/[view]">) {
  const { view } = await params;
  if (!isPlanView(view)) notFound();
  // Suspense: both read ?d with useSearchParams.
  return (
    <Suspense>
      <PageActions>
        <PlanViewSwitch current={view} />
      </PageActions>
      <Planner view={view} />
    </Suspense>
  );
}

export function generateStaticParams() {
  return [{ view: "day" }, { view: "week" }, { view: "month" }];
}
