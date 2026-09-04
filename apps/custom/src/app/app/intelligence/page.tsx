import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/auth";
import { IntelligenceClient } from "./IntelligenceClient";

export const metadata = {
  title: "Trade Intelligence | Qubere",
  description: "Nationwide HTS benchmarks, broker QA metrics and supplier risk scores.",
};

export default async function IntelligencePage() {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");

  return <IntelligenceClient />;
}
