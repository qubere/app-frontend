import { NextRequest, NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { activateProductWorkspace } from "@/modules/shipments/services/shipmentProductWorkspaceService";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const { searchParams } = new URL(req.url);
      const mode = searchParams.get("mode");
      const status = searchParams.get("status");

      const where: any = {
        accountId: ctx.accountId,
        deletedAt: null,
        productWorkspaces: {
          some: {
            product: "TMS",
            status: "ACTIVE",
          },
        },
      };

      if (mode && mode !== "all") where.transportMode = mode.toUpperCase();
      if (status && status !== "all") where.status = status;

      const shipments = await db.shipment.findMany({
        where,
        take: 50,
        orderBy: { createdAt: "desc" },
        include: {
          customsFilings: true,
          exceptionItems: true,
          productWorkspaces: true,
        },
      });

      return NextResponse.json({
        count: shipments.length,
        shipments,
      });
    } catch {
      return NextResponse.json({ count: 0, shipments: [] });
    }
  },
  { permission: "shipment.read" }
);

export const POST = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const body = await req.json().catch(() => ({}));
      const importerName = body.importerName?.trim() || "Acme Import Logistics LLC";
      const transportMode = (body.transportMode || "OCEAN").toUpperCase();
      const originPort = body.originPort?.trim() || body.countryOfExport || "CNSHA";
      const destinationPort = body.destinationPort?.trim() || body.destinationCountry || "USOAK";
      const poReference = body.poReference?.trim() || `PO-${Math.floor(100000 + Math.random() * 900000)}`;
      const customsRequired = Boolean(body.customsRequired);

      const shipmentNumber = `SHP-2026-${Math.floor(100000 + Math.random() * 900000)}`;

      const shipment = await db.shipment.create({
        data: {
          accountId: ctx.accountId,
          shipmentNumber,
          importerName,
          transportMode,
          countryOfExport: originPort,
          countryOfOrigin: originPort,
          destinationCountry: destinationPort,
          portOfEntry: destinationPort,
          poReference,
          customsRequired,
          status: "In Progress",
          currentStage: "DOCUMENT_INTAKE",
          readinessScore: 85,
          riskScore: 15,
          estimatedArrival: new Date(Date.now() + 14 * 86400 * 1000),
          customerPromiseDate: new Date(Date.now() + 15 * 86400 * 1000),
          productWorkspaces: {
            create: {
              accountId: ctx.accountId,
              product: "TMS",
              status: "ACTIVE",
              source: "TMS_INTAKE",
              activatedByUserId: ctx.userId,
            },
          },
        },
        include: {
          productWorkspaces: true,
        },
      });

      return NextResponse.json({
        ok: true,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        shipment,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: err.message || "Failed to create shipment" },
        { status: 500 }
      );
    }
  },
  { permission: "shipment.create", write: true }
);
