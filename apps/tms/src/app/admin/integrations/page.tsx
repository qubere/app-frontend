import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { IntegrationsClient } from "./IntegrationsClient";

export default async function AdminIntegrationsPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <IntegrationsClient />;
}
