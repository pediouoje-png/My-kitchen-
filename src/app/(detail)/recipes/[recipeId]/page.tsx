import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/misc";
import { RecipeDetailScreen } from "@/features/recipes/RecipeDetailScreen";

export const metadata: Metadata = { title: "레시피" };

export default function RecipeDetailPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <RecipeDetailScreen />
    </Suspense>
  );
}
