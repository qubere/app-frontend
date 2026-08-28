import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";

export const GET = withAuthenticatedRoute(async ({ ctx }) => {
  const count = await db.exceptionItem.count({ where: { status: "Open", accountId: ctx.accountId } });
  return NextResponse.json({ count });
});
