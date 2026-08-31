import type { Metadata } from "next";
import { SupportCenterClient } from "./SupportCenterClient";

export const metadata: Metadata = {
  title: "Help Center | Qubere",
  description: "Search task-based help for Qubere customs brokerage workflows.",
};

export default function SupportPage() {
  return <SupportCenterClient />;
}
