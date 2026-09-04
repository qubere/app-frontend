import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { db } from "@qubere/db";
import { z } from "zod";

const createShipmentSchema = z.object({
  importerName: z.string().trim().min(1).max(240),
  transportMode: z.enum(["OCEAN", "AIR", "TRUCK", "RAIL"]),
  originPort: z.string().trim().min(2).max(120),
  destinationPort: z.string().trim().min(2).max(120),
  poReference: z.string().trim().max(120).nullable().optional(),
  customsRequired: z.boolean().default(false),
});

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
      const parsed = createShipmentSchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Shipment input is incomplete or invalid", issues: parsed.error.issues },
          { status: 400 }
        );
      }
      const input = parsed.data;
      const year = new Date().getUTCFullYear();

      const shipment = await db.$transaction(async (transaction) => {
        const sequence = await transaction.shipmentSequence.upsert({
          where: { accountId_year: { accountId: ctx.accountId, year } },
          create: { accountId: ctx.accountId, year, lastValue: 1 },
          update: { lastValue: { increment: 1 } },
          select: { lastValue: true },
        });
        const shipmentNumber = `SHP-${year}-${String(sequence.lastValue).padStart(6, "0")}`;
        return transaction.shipment.create({
          data: {
            accountId: ctx.accountId,
            shipmentNumber,
            importerName: input.importerName,
            transportMode: input.transportMode,
            portOfEntry: input.destinationPort,
            poReference: input.poReference ?? null,
            customsRequired: input.customsRequired,
            status: "In Progress",
            currentStage: "DOCUMENT_INTAKE",
            trackingStops: {
              create: [
                {
                  accountId: ctx.accountId,
                  sequence: 1,
                  type: "ORIGIN",
                  role: "ORIGIN",
                  name: input.originPort,
                  unlocode: input.originPort,
                },
                {
                  accountId: ctx.accountId,
                  sequence: 2,
                  type: "DESTINATION",
                  role: "PORT_OF_DISCHARGE",
                  name: input.destinationPort,
                  unlocode: input.destinationPort,
                },
              ],
            },
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
          include: { productWorkspaces: true, trackingStops: true },
        });
      });

      return NextResponse.json({
        ok: true,
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        shipment,
      });
    } catch (err: unknown) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Failed to create shipment" },
        { status: 500 }
      );
    }
  },
  { permission: "shipment.create", write: true }
);
