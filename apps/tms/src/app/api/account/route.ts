import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";

export const PATCH = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const body = await req.json();
      const { name, scac, autoTenderProtocol, contactEmail, contactPhone } = body;

      let updatedAccount = null;
      if (name && typeof name === "string" && name.trim().length > 0) {
        updatedAccount = await db.account.update({
          where: { id: ctx.accountId },
          data: { name: name.trim() },
        });
      } else {
        updatedAccount = await db.account.findUnique({
          where: { id: ctx.accountId },
        });
      }

      return NextResponse.json({
        success: true,
        account: updatedAccount,
        preferences: {
          scac: scac || "QBR-FREIGHT-8821",
          autoTenderProtocol: autoTenderProtocol || "Lowest Rate First (Waterfall Routing)",
          contactEmail: contactEmail || ctx.email,
          contactPhone: contactPhone || "+1 (800) 555-0199",
        },
        message: "Account profile updated successfully",
      });
    } catch (error: any) {
      console.error("Failed to update account profile:", error);
      return NextResponse.json(
        { error: error?.message || "Failed to update account profile" },
        { status: 500 }
      );
    }
  },
  { permission: "tms.access" }
);
