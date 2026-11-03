import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/misc";
import { PlannerScreen } from "@/features/meal-planner/PlannerScreen";

export const metadata: Metadata = { title: "식단" };

export default function PlannerPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <PlannerScreen />
    </Suspense>
  );
}
