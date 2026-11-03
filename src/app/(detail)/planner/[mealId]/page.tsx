import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/misc";
import { MealDetailScreen } from "@/features/meal-planner/MealDetailScreen";

export const metadata: Metadata = { title: "식사" };

export default function MealDetailPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <MealDetailScreen />
    </Suspense>
  );
}
