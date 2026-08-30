import { redirect } from "next/navigation";
import { getAccountContext } from "@/lib/auth";
import { HtsWorkspaceClient } from "./HtsWorkspaceClient";

export const metadata = {
  title: "HTS Lookup | Qubere",
  description: "Search the Harmonized Tariff Schedule — codes, duty rates, hierarchy and legal chapter notes.",
};

export default async function HtsWorkspacePage(props: {
  searchParams: Promise<{ code?: string }>;
}) {
  const ctx = await getAccountContext();
  if (!ctx) redirect("/sign-in");

  const { code } = await props.searchParams;

  return <HtsWorkspaceClient initialCode={typeof code === "string" ? code : null} />;
}
