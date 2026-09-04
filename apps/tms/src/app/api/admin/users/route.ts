import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";

export const GET = withAuthenticatedRoute(
  async ({ ctx }: any) => {
    try {
      const memberships = await db.accountMembership.findMany({
        where: { accountId: ctx.accountId },
        include: { user: true },
      });

      const members = memberships.map((m) => ({
        id: m.userId,
        name: `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || m.user?.email || "User",
        email: m.user?.email || "",
        role: (m as any).role ?? "MEMBER",
        status: "ACTIVE",
      }));

      return NextResponse.json({
        accountId: ctx.accountId,
        accountName: ctx.accountName,
        members,
      });
    } catch {
      return NextResponse.json({ error: "Failed to fetch workspace members" }, { status: 500 });
    }
  },
  { permission: "tms.access" }
);
