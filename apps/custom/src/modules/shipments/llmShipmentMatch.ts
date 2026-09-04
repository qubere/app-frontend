/**
 * LLM-assisted shipment suggestion for inbound documents.
 *
 * The deterministic matcher (`shipmentMatching.ts`) only ever turns an *exact*
 * identifier into a match. That is the right stance for auto-filing, but it is
 * blind to how forwarders actually write: "please clear this against the Nike
 * order landing Thursday", a typo'd booking number, a reference in a language
 * the regex does not model, or a shipment named only in the email body.
 *
 * This module adds an interpretation layer. Gemini reads the subject, body,
 * filename and parsed document text together with the client's own candidate
 * shipments and proposes one, with a short reason and the identifiers it saw.
 *
 * It never decides anything on its own. The caller
 * (`resolveShipmentForDocument`) only auto-attaches when the LLM's suggestion is
 * *also* corroborated by a deterministic exact-identifier hit in the database —
 * so a hallucinated shipment id or an over-confident guess cannot silently
 * attach a document to the wrong entry. A pure-intent suggestion is surfaced to
 * a human, never actioned.
 */

import { getGeminiClient } from "@/lib/ai/geminiClient";
import { aiModel } from "@/lib/ai/aiModel";
import { meterGeminiCall } from "@/lib/ai/aiMeter";
import { db } from "@/lib/db";
import type { MatchIdentifierType } from "@/modules/shipments/identifierExtraction";

/** Statuses a document would never reasonably be filed against. */
const TERMINAL_SHIPMENT_STATUSES = ["Completed", "DELIVERED", "Delivered with Exception", "Cancelled"];

const MAX_CANDIDATES = 60;
/** Keep each free-text field bounded so a large document cannot blow the prompt. */
const MAX_TEXT_CHARS = 6_000;

export interface CandidateShipment {
  id: string;
  shipmentNumber: string;
  poReference: string | null;
  importerName: string | null;
  originCountry: string | null;
  destinationCountry: string | null;
  carrierName: string | null;
  status: string;
  estimatedArrival: string | null;
  identifiers: Array<{ type: string; value: string }>;
}

export interface LlmShipmentSuggestion {
  suggestedShipmentId: string | null;
  confidence: number;
  reasoning: string;
  extractedIdentifiers: Array<{ type: string; value: string }>;
  alternativeShipmentIds: string[];
  model: string;
}

/** The client's open shipments, scoped to the client — never another client's. */
export async function loadCandidateShipments(
  accountId: string,
  clientId: string | null | undefined
): Promise<CandidateShipment[]> {
  const rows = await db.shipment.findMany({
    where: {
      accountId,
      deletedAt: null,
      // clientId may legitimately be null (account-level shipment); match that
      // exactly rather than widening to every client.
      ...(clientId !== undefined ? { clientId: clientId ?? null } : {}),
      status: { notIn: TERMINAL_SHIPMENT_STATUSES },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_CANDIDATES,
    select: {
      id: true,
      shipmentNumber: true,
      poReference: true,
      importerName: true,
      countryOfOrigin: true,
      destinationCountry: true,
      carrierName: true,
      status: true,
      estimatedArrival: true,
      trackingIdentifiers: { select: { type: true, value: true }, take: 12 },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    shipmentNumber: r.shipmentNumber,
    poReference: r.poReference,
    importerName: r.importerName,
    originCountry: r.countryOfOrigin,
    destinationCountry: r.destinationCountry,
    carrierName: r.carrierName,
    status: r.status,
    estimatedArrival: r.estimatedArrival ? r.estimatedArrival.toISOString().slice(0, 10) : null,
    identifiers: r.trackingIdentifiers.map((t: { type: string; value: string }) => ({ type: String(t.type), value: t.value })),
  }));
}

export interface SuggestShipmentInput {
  accountId: string;
  userId?: string | null;
  clientId?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  fileName?: string | null;
  parsedText?: string | null;
  candidateShipments: CandidateShipment[];
}

const clip = (v: string | null | undefined): string => (v ?? "").slice(0, MAX_TEXT_CHARS);

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    suggestedShipmentId: { type: "string", nullable: true },
    confidence: { type: "number" },
    reasoning: { type: "string" },
    extractedIdentifiers: {
      type: "array",
      items: {
        type: "object",
        properties: { type: { type: "string" }, value: { type: "string" } },
        required: ["type", "value"],
      },
    },
    alternativeShipmentIds: { type: "array", items: { type: "string" } },
  },
  required: ["suggestedShipmentId", "confidence", "reasoning", "extractedIdentifiers", "alternativeShipmentIds"],
} as const;

const SYSTEM_PROMPT = `You match an inbound customs document to exactly one shipment from a supplied list.

Rules:
- Choose a shipment ONLY from the "candidates" list. Return its exact "id".
- If nothing is a clear match, return suggestedShipmentId = null. Do not guess.
- "confidence" is 0..1: 1.0 only when an explicit identifier (shipment number, PO,
  container, bill of lading, booking, AWB) in the text resolves to that one candidate.
  A match from intent/context alone ("the Nike order", "yesterday's shipment") is at
  most 0.6.
- "reasoning": one or two plain sentences a customs broker can act on. Name the
  signal you used.
- "extractedIdentifiers": every shipment/PO/container/BL/booking/AWB identifier you
  see anywhere in the text, with a type label. Include malformed ones.
- "alternativeShipmentIds": other candidate ids that are plausible, best first.
- Never invent an id that is not in the candidates list.`;

/**
 * Asks Gemini to propose a shipment. Returns null when there is nothing to match
 * against or the call fails — matching must degrade to the deterministic path,
 * never break, on an AI outage.
 */
export async function suggestShipmentWithLLM(
  input: SuggestShipmentInput
): Promise<LlmShipmentSuggestion | null> {
  if (input.candidateShipments.length === 0) return null;
  const haveText =
    clip(input.emailSubject) || clip(input.emailBody) || clip(input.fileName) || clip(input.parsedText);
  if (!haveText) return null;

  const model = aiModel("shipment-match");
  const payload = {
    document: {
      emailSubject: clip(input.emailSubject),
      emailBody: clip(input.emailBody),
      fileName: input.fileName ?? "",
      parsedDocumentText: clip(input.parsedText),
    },
    candidates: input.candidateShipments.map((c) => ({
      id: c.id,
      shipmentNumber: c.shipmentNumber,
      poReference: c.poReference,
      importer: c.importerName,
      origin: c.originCountry,
      destination: c.destinationCountry,
      carrier: c.carrierName,
      status: c.status,
      estimatedArrival: c.estimatedArrival,
      identifiers: c.identifiers,
    })),
  };

  try {
    const client = getGeminiClient();
    const response = await client.models.generateContent({
      model,
      contents: [
        { role: "user", parts: [{ text: `${SYSTEM_PROMPT}\n\nINPUT:\n${JSON.stringify(payload)}` }] },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA as unknown as Record<string, unknown>,
        temperature: 0.1,
      },
    });

    await meterGeminiCall("shipment-match", { accountId: input.accountId, userId: input.userId ?? null }, response);

    const parsed = JSON.parse(response.text || "{}") as Partial<LlmShipmentSuggestion>;
    const validIds = new Set(input.candidateShipments.map((c) => c.id));

    const suggestedShipmentId =
      typeof parsed.suggestedShipmentId === "string" && validIds.has(parsed.suggestedShipmentId)
        ? parsed.suggestedShipmentId
        : null;

    return {
      suggestedShipmentId,
      confidence: clampConfidence(parsed.confidence),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.slice(0, 500) : "",
      extractedIdentifiers: Array.isArray(parsed.extractedIdentifiers)
        ? parsed.extractedIdentifiers
            .filter((e): e is { type: string; value: string } => !!e && typeof e.value === "string")
            .map((e) => ({ type: String(e.type ?? "UNKNOWN").toUpperCase(), value: e.value }))
            .slice(0, 40)
        : [],
      alternativeShipmentIds: Array.isArray(parsed.alternativeShipmentIds)
        ? parsed.alternativeShipmentIds.filter((id) => typeof id === "string" && validIds.has(id) && id !== suggestedShipmentId)
        : [],
      model,
    };
  } catch (error) {
    console.error("[llmShipmentMatch] suggestion failed; falling back to deterministic match", {
      accountId: input.accountId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function clampConfidence(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  return Math.max(0, Math.min(1, n));
}

/** Maps an LLM identifier label onto the deterministic matcher's type set. */
export function normalizeLlmIdentifierType(raw: string): MatchIdentifierType | null {
  const t = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (t.includes("SHIPMENT")) return "SHIPMENT_NUMBER";
  if (t.includes("PO") || t.includes("PURCHASE")) return "PO_REFERENCE";
  if (t.includes("CONTAINER")) return "CONTAINER";
  if (t.includes("BOOKING")) return "BOOKING";
  if (t === "MBL" || t.includes("MASTERBILL") || t.includes("MASTERBL")) return "MBL";
  if (t === "HBL" || t.includes("HOUSEBILL") || t.includes("HOUSEBL")) return "HBL";
  if (t.includes("MAWB") || t.includes("MASTERAIR")) return "MAWB";
  if (t.includes("HAWB") || t.includes("HOUSEAIR")) return "HAWB";
  if (t.includes("BL") || t.includes("BILLOFLADING")) return "MBL";
  return null;
}
