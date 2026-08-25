import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";

export const GET = withAuthenticatedRoute(
  async ({ ctx }: any) => {
    try {
      const carriers = await db.carrier.findMany({
        where: { accountId: ctx.accountId },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ carriers });
    } catch {
      return NextResponse.json({ error: "Failed to fetch carriers" }, { status: 500 });
    }
  },
  { permission: "carriers.manage" }
);
