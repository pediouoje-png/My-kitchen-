import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/misc";
import { RecipesScreen } from "@/features/recipes/RecipesScreen";

export const metadata: Metadata = { title: "추천" };

export default function RecipesPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <RecipesScreen />
    </Suspense>
  );
}
