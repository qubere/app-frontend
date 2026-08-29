import { NextResponse } from "next/server";
import { z } from "zod";
import { DocumentType, LegDocumentRequirement } from "@prisma/client";
import { matchDocumentToSlot, inferLegDocuments } from "@qubere/shipment-legs";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { validatePathParams, parseAndValidateBody } from "@/lib/api/validation";
import { db } from "@/lib/db";
import { getShipmentTrackingProjection } from "@/modules/tracking/shipmentTracking";

const paramsSchema = z.object({ id: z.string().min(1), legId: z.string().min(1) });

const postSchema = z.object({
  documentId: z.string().min(1).nullable().optional(),
  slotKey: z.string().min(1).max(64).optional(),
  slotLabel: z.string().min(1).max(120).optional(),
  expectedDocType: z.nativeEnum(DocumentType).optional(),
  requirement: z.nativeEnum(LegDocumentRequirement).optional(),
  requirementReason: z.string().max(300).optional(),
});

const patchSchema = z.object({
  legDocumentId: z.string().min(1),
  requirement: z.nativeEnum(LegDocumentRequirement).optional(),
  requirementReason: z.string().max(300).nullable().optional(),
});

async function loadLeg(accountId: string, shipmentIdOrNumber: string, legId: string) {
  return db.shipmentLeg.findFirst({
    where: {
      id: legId,
      accountId,
      shipment: {
        accountId,
        deletedAt: null,
        OR: [{ id: shipmentIdOrNumber }, { shipmentNumber: shipmentIdOrNumber }],
      },
    },
    include: { legDocuments: true },
  });
}

export const POST = withAuthenticatedRoute<{ id: string; legId: string }>(
  async ({ req, ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;

    const body = await parseAndValidateBody(req, postSchema, requestId);
    if ("response" in body) return body.response;

    const leg = await loadLeg(ctx.accountId, p.data.id, p.data.legId);
    if (!leg) return NextResponse.json({ error: "Shipment leg not found" }, { status: 404 });

    const b = body.data;

    // Verify the document is on this shipment / account.
    let doc: { id: string; docType: string; documentType: DocumentType | null; fileName: string } | null = null;
    if (b.documentId) {
      doc = await db.shipmentDocument.findFirst({
        where: { id: b.documentId, accountId: ctx.accountId, shipmentId: leg.shipmentId },
        select: { id: true, docType: true, documentType: true, fileName: true },
      });
      if (!doc) {
        return NextResponse.json(
          { error: "Document not found on this shipment", code: "LEG_DOC_NOT_ON_SHIPMENT" },
          { status: 422 }
        );
      }
    }

    // Resolve which slot to fill.
    const catalog = inferLegDocuments(leg.legType, leg.mode).slots;
    let slotKey = b.slotKey ?? null;
    if (!slotKey && doc) {
      slotKey = matchDocumentToSlot(doc, catalog) ?? matchDocumentToSlot(doc, leg.legDocuments.map((d) => ({
        slotKey: d.slotKey, slotLabel: d.slotLabel, expectedDocType: d.expectedDocType,
        requirement: d.requirement, requirementReason: d.requirementReason ?? "",
      })));
    }
    if (!slotKey) {
      // Ad-hoc slot keyed on the document type so it stays unique.
      slotKey = `ADHOC_${b.expectedDocType ?? doc?.documentType ?? "OTHER"}`;
    }

    const catalogSlot = catalog.find((s) => s.slotKey === slotKey);
    const existing = leg.legDocuments.find((d) => d.slotKey === slotKey);

    const legDoc = existing
      ? await db.shipmentLegDocument.update({
          where: { id: existing.id },
          data: {
            documentId: b.documentId === undefined ? existing.documentId : b.documentId,
            requirement: b.requirement ?? existing.requirement,
            requirementReason: b.requirementReason ?? existing.requirementReason,
          },
        })
      : await db.shipmentLegDocument.create({
          data: {
            accountId: ctx.accountId,
            legId: leg.id,
            documentId: b.documentId ?? null,
            slotKey,
            slotLabel: b.slotLabel ?? catalogSlot?.slotLabel ?? slotKey.replace(/_/g, " "),
            expectedDocType: b.expectedDocType ?? catalogSlot?.expectedDocType ?? DocumentType.OTHER,
            requirement: b.requirement ?? catalogSlot?.requirement ?? LegDocumentRequirement.OPTIONAL,
            requirementReason: b.requirementReason ?? catalogSlot?.requirementReason ?? "Added by broker",
            source: "MANUAL",
          },
        });

    const projection = await getShipmentTrackingProjection(ctx.accountId, leg.shipmentId);
    return NextResponse.json({ legDocument: legDoc, journey: projection?.journey ?? null }, { status: 201 });
  },
  { permission: "shipments.manage", write: true }
);

export const PATCH = withAuthenticatedRoute<{ id: string; legId: string }>(
  async ({ req, ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;

    const body = await parseAndValidateBody(req, patchSchema, requestId);
    if ("response" in body) return body.response;

    const leg = await loadLeg(ctx.accountId, p.data.id, p.data.legId);
    if (!leg) return NextResponse.json({ error: "Shipment leg not found" }, { status: 404 });

    const target = leg.legDocuments.find((d) => d.id === body.data.legDocumentId);
    if (!target) return NextResponse.json({ error: "Checklist row not found" }, { status: 404 });

    const updated = await db.shipmentLegDocument.update({
      where: { id: target.id },
      data: {
        requirement: body.data.requirement ?? target.requirement,
        requirementReason:
          body.data.requirementReason === undefined ? target.requirementReason : body.data.requirementReason,
      },
    });

    const projection = await getShipmentTrackingProjection(ctx.accountId, leg.shipmentId);
    return NextResponse.json({ legDocument: updated, journey: projection?.journey ?? null });
  },
  { permission: "shipments.manage", write: true }
);

export const DELETE = withAuthenticatedRoute<{ id: string; legId: string }>(
  async ({ req, ctx, requestId, params }) => {
    const p = validatePathParams(params, paramsSchema, requestId);
    if ("response" in p) return p.response;

    const q = z
      .object({ legDocumentId: z.string().min(1) })
      .safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!q.success) return NextResponse.json({ error: "legDocumentId query param required" }, { status: 400 });

    const leg = await loadLeg(ctx.accountId, p.data.id, p.data.legId);
    if (!leg) return NextResponse.json({ error: "Shipment leg not found" }, { status: 404 });

    const target = leg.legDocuments.find((d) => d.id === q.data.legDocumentId);
    if (!target) return NextResponse.json({ error: "Checklist row not found" }, { status: 404 });

    if (target.source === "MANUAL" && target.requirement === "OPTIONAL") {
      // Broker-added ad-hoc slot — remove it entirely.
      await db.shipmentLegDocument.delete({ where: { id: target.id } });
    } else {
      // Required/inferred slot — keep the gap, just detach the document.
      await db.shipmentLegDocument.update({ where: { id: target.id }, data: { documentId: null } });
    }

    const projection = await getShipmentTrackingProjection(ctx.accountId, leg.shipmentId);
    return NextResponse.json({ success: true, journey: projection?.journey ?? null });
  },
  { permission: "shipments.manage", write: true }
);
