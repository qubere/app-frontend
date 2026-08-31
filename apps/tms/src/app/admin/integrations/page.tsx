import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { hasPermission } from "@qubere/auth";
import { AccessDenied } from "@/components/AccessDenied";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function AdminIntegrationsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!(await hasPermission("integration.read"))) {
    return <AccessDenied />;
  }

  return <IntegrationsClient />;
}
