import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { parseIntakeRequest } from "@/modules/orders/services/intakeParserService";

export const POST = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      let body: any = {};
      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("form")) {
        const formData = await req.formData();
        body = {
          rawText: (formData.get("text") as string) || (formData.get("rawText") as string) || "",
          requestedBy: formData.get("requestedBy") as string | undefined,
        };
      } else {
        body = await req.json().catch(() => ({}));
      }

      const rawText = body.rawText || body.text || "";

      const result = await parseIntakeRequest(ctx, {
        rawText,
        requestedBy: body.requestedBy,
        customerReference: body.customerReference,
        poReferences: body.poReferences,
        commodityDescription: body.commodityDescription,
        mode: body.mode,
        equipmentRequirements: body.equipmentRequirements,
        incoterm: body.incoterm,
        origin: body.origin,
        destination: body.destination,
        customsRequired: body.customsRequired,
        confidence: body.confidence,
        evidenceItems: body.evidenceItems,
      });

      if (contentType.includes("form")) {
        return NextResponse.redirect(new URL("/orders", req.url), 303);
      }

      return NextResponse.json(result);
    } catch (error: any) {
      return NextResponse.json({ error: error.message || "Failed to parse intake request" }, { status: 500 });
    }
  },
  { permission: "transportation_orders.write", write: true }
);
