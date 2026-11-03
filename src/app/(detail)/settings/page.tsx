import type { Metadata } from "next";
import { SettingsScreen } from "@/features/settings/SettingsScreen";

export const metadata: Metadata = { title: "설정" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
