/**
 * POST /api/v1/intake/document
 *
 * External document-ingest endpoint. Accepts either a single document or a
 * batch, from an ERP, TMS, or integration partner: creates a ShipmentDocument
 * row per item and enqueues classification + extraction. Authenticated via API
 * key (scope `documents:write`).
 *
 * Body — one of:
 *   { url, documentType?, shipmentReference?, fileName? }            (single)
 *   { documents: [ { url, ... }, ... ] }                            (batch, max 25)
 *
 * Response:
 *   single  -> 202 { documentId, processingStatus, shipmentId, candidates, requestId }
 *   batch   -> 202 { results: [ { index, documentId, status, shipmentId, candidates } | { index, status: "error", error } ], requestId }
 *   any item fails schema validation -> 422 { error, issues|results, requestId } and nothing is enqueued
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, withAccountIdContext } from "@/lib/db";
import { authenticateApiKey, apiKeyHasScope } from "@/lib/api/api-key-auth";
import { generateRequestId } from "@/lib/api/error";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { readStoredObject, resolveStorageOrigin, StorageValidationError } from "@/lib/storage";
import { matchShipmentForDocument } from "@/modules/shipments/shipmentMatching";

const MAX_BATCH = 25;

const itemSchema = z.object({
  /** Publicly reachable URL or internal storage URL for the document file. */
  url: z.string().url(),
  /** Optional document type hint (e.g. "COMMERCIAL_INVOICE"). If absent the classifier assigns it. */
  documentType: z.string().max(100).optional(),
  /** Shipment number / PO reference used to attach to an existing shipment. Optional. */
  shipmentReference: z.string().max(200).optional(),
  /** Human-readable original filename. Defaults to the last path segment of url. */
  fileName: z.string().max(500).optional(),
});

const bodySchema = z.union([
  itemSchema,
  z.object({ documents: z.array(itemSchema).min(1).max(MAX_BATCH) }),
]);

type Item = z.infer<typeof itemSchema>;

interface ItemResult {
  index: number;
  status: "queued" | "error";
  documentId?: string;
  shipmentId?: string | null;
  candidates?: Array<{ shipmentId: string; score: number; matchedOn: string }>;
  error?: string;
}

async function ingestOne(accountId: string, item: Item, index: number): Promise<ItemResult> {
  try {
    resolveStorageOrigin(item.url);
  } catch (err) {
    if (err instanceof StorageValidationError) {
      return { index, status: "error", error: `Untrusted document URL origin: ${err.message}` };
    }
    throw err;
  }

  const fileName = item.fileName ?? item.url.split("/").pop()?.split("?")[0] ?? "document";

  // Exact caller-supplied reference wins outright.
  let shipmentId: string | null = null;
  if (item.shipmentReference) {
    const matched = await db.shipment.findFirst({
      where: {
        accountId,
        deletedAt: null,
        OR: [{ shipmentNumber: item.shipmentReference }, { poReference: item.shipmentReference }],
      },
      select: { id: true },
    });
    shipmentId = matched?.id ?? null;
  }

  const doc = await db.shipmentDocument.create({
    data: {
      accountId,
      shipmentId,
      docType: item.documentType ?? "Unknown",
      fileName,
      fileUrl: item.url,
      status: "Received",
      source: "API",
    },
    select: { id: true },
  });

  // Cheap synchronous match on identifiers present in the filename / reference
  // (ERP exports are often named e.g. "INV_SHP-2026-000042.pdf"). Full matching
  // still runs in the worker once the document is parsed.
  let candidates: ItemResult["candidates"] = [];
  if (!shipmentId) {
    try {
      const result = await matchShipmentForDocument({
        accountId,
        documentId: doc.id,
        emailSubject: `${fileName} ${item.shipmentReference ?? ""}`.trim(),
        parsedText: null,
      });
      if (result.matchedShipmentId) {
        await db.shipmentDocument.update({
          where: { id: doc.id },
          data: { shipmentId: result.matchedShipmentId },
        });
        shipmentId = result.matchedShipmentId;
      }
      candidates = result.candidates.map((c) => ({
        shipmentId: c.shipmentId,
        score: c.score,
        matchedOn: `${c.best.type}:${c.best.value}`,
      }));
    } catch {
      // Non-fatal — the worker will retry matching after parse.
    }
  }

  await createAuditLog({
    accountId,
    action: AuditAction.DOCUMENT_QUEUED,
    entity: "ShipmentDocument",
    entityId: doc.id,
    source: "API",
    metadata: { url: item.url, documentType: item.documentType, shipmentReference: item.shipmentReference, shipmentId, fileName },
  });

  // Fire-and-forget: enqueue classification + extraction.
  void (async () => {
    try {
      const stored = await readStoredObject(item.url);

      // Malware scan before extraction touches the bytes. A non-safe verdict
      // quarantines the document and stops here.
      const { scanDocumentForMalware } = await import("@/lib/security/scanDocument");
      const scan = await scanDocumentForMalware(doc.id, stored.body, { fileName });
      if (!scan.safe) return;

      const { DocumentIntelligenceAgent } = await import("@/modules/agents/documentIntelligenceAgent");
      await DocumentIntelligenceAgent.execute({
        accountId,
        userId: null,
        shipmentId: shipmentId ?? "",
        packetId: `pkt_intake_${doc.id.slice(0, 8)}`,
        fileBuffer: stored.body,
        fileName,
        mimeType: stored.contentType ?? "application/pdf",
        docTypeCode: item.documentType,
        forceOverwrite: false,
      });
    } catch (err) {
      console.error("[intake/document] Background extraction failed:", err);
    }
  })();

  return { index, status: "queued", documentId: doc.id, shipmentId, candidates };
}

export async function POST(req: Request): Promise<Response> {
  const requestId = generateRequestId();

  const apiCtx = await authenticateApiKey(req);
  if (!apiCtx) {
    return NextResponse.json({ error: "Unauthorized: valid API key required", requestId }, { status: 401 });
  }
  if (!apiKeyHasScope(apiCtx, "documents:write")) {
    return NextResponse.json(
      { error: "Forbidden: key does not have documents:write scope", requestId },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", requestId }, { status: 400 });
  }

  // Surface an over-cap batch as its own clear error rather than a generic
  // union-validation failure.
  if (
    body && typeof body === "object" && "documents" in body &&
    Array.isArray((body as { documents: unknown[] }).documents) &&
    (body as { documents: unknown[] }).documents.length > MAX_BATCH
  ) {
    return NextResponse.json(
      { error: `Too many documents: max ${MAX_BATCH} per request`, requestId },
      { status: 422 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", issues: parsed.error.issues, requestId },
      { status: 422 }
    );
  }

  const isBatch = "documents" in parsed.data && Array.isArray(parsed.data.documents);
  const items: Item[] =
    "documents" in parsed.data && Array.isArray(parsed.data.documents)
      ? parsed.data.documents
      : [parsed.data as Item];

  return withAccountIdContext(apiCtx.accountId, async () => {
    const results: ItemResult[] = [];
    for (let i = 0; i < items.length; i++) {
      results.push(await ingestOne(apiCtx.accountId, items[i], i));
    }

    if (!isBatch) {
      const r = results[0];
      if (r.status === "error") {
        return NextResponse.json({ error: r.error, requestId }, { status: 422 });
      }
      return NextResponse.json(
        {
          documentId: r.documentId,
          processingStatus: "QUEUED",
          shipmentId: r.shipmentId ?? null,
          candidates: r.candidates ?? [],
          requestId,
        },
        { status: 202 }
      );
    }

    return NextResponse.json({ results, requestId }, { status: 202 });
  });
}
