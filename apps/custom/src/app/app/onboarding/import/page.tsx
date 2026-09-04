import { getAccountContext, hasPermission } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BulkImportClient } from "./BulkImportClient";

export default async function BulkImportPage() {
  if (!(await getAccountContext())) redirect("/sign-in");
  if (!(await hasPermission("onboarding.manage"))) redirect("/app/dashboard");
  return <BulkImportClient />;
}
