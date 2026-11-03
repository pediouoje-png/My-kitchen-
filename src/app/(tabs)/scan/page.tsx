import type { Metadata } from "next";
import { ScanScreen } from "@/features/scan/ScanScreen";

export const metadata: Metadata = { title: "추가" };

export default function ScanPage() {
  return <ScanScreen />;
}
