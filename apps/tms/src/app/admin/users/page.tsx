import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserManagementClient } from "./UserManagementClient";

export default async function AdminUsersPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <UserManagementClient />;
}
