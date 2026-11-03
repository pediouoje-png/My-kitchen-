import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/misc";
import { FridgeScreen } from "@/features/inventory/FridgeScreen";

export const metadata: Metadata = { title: "냉장고" };

export default function FridgePage() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <FridgeScreen />
    </Suspense>
  );
}
