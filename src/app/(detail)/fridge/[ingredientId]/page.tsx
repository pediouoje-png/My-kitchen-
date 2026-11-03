import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/misc";
import { IngredientDetailScreen } from "@/features/inventory/IngredientDetailScreen";

export const metadata: Metadata = { title: "식재료" };

export default function IngredientDetailPage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <IngredientDetailScreen />
    </Suspense>
  );
}
