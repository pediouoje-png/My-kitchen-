import type { Metadata } from "next";
import { ReviewScreen } from "@/features/scan/ReviewScreen";

export const metadata: Metadata = { title: "분석 결과 검수" };

export default function ReviewPage() {
  return <ReviewScreen />;
}
