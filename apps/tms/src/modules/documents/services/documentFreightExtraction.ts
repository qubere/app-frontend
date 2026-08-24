import { GoogleGenAI, Type } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const nullableString = z.string().trim().min(1).nullable().default(null);
const nullableNumber = z.number().finite().nullable().default(null);

const normalizeMode = (val: unknown): "OCEAN" | "AIR" | "TRUCK" | "RAIL" | "DRAYAGE" | null => {
  if (!val || typeof val !== "string") return null;
  const upper = val.trim().toUpperCase();
  if (["OCEAN", "SEA", "MARITIME", "VESSEL", "FCL", "LCL", "BOAT", "BARGE"].some((k) => upper.includes(k))) return "OCEAN";
  if (["AIR", "FLIGHT", "AV", "PLANE"].some((k) => upper.includes(k))) return "AIR";
  if (["TRUCK", "ROAD", "FTL", "LTL", "HIGHWAY", "MOTOR"].some((k) => upper.includes(k))) return "TRUCK";
  if (["RAIL", "TRAIN", "INTERMODAL"].some((k) => upper.includes(k))) return "RAIL";
  if (["DRAYAGE", "DRAY", "CARTAGE", "HAUL"].some((k) => upper.includes(k))) return "DRAYAGE";
  return null;
};

const normalizeConfidence = (val: unknown): number => {
  if (typeof val !== "number" || !Number.isFinite(val)) return 95;
  if (val > 0 && val <= 1.0) return Math.round(val * 100);
  return Math.min(100, Math.max(0, Math.round(val)));
};

const normalizeDocumentType = (val: unknown): string => {
  if (!val || typeof val !== "string") return "OTHER";
  const upper = val.trim().toUpperCase();
  if (upper.includes("BOOKING_REQUEST") || upper.includes("BOOKING REQUEST")) return "BOOKING_REQUEST";
  if (upper.includes("BOOKING_CONFIRMATION") || upper.includes("BOOKING CONFIRMATION") || upper.includes("BOOKING_CONF")) return "BOOKING_CONFIRMATION";
  if (upper.includes("BILL_OF_LADING") || upper.includes("BOL") || upper.includes("B/L") || upper.includes("BOOKING")) return "BILL_OF_LADING";
  if (upper.includes("AIR_WAYBILL") || upper.includes("AWB")) return "AIR_WAYBILL";
  if (upper.includes("COMMERCIAL_INVOICE") || upper.includes("INVOICE")) return "COMMERCIAL_INVOICE";
  if (upper.includes("PACKING_LIST")) return "PACKING_LIST";
  if (upper.includes("PROOF_OF_DELIVERY") || upper.includes("POD")) return "PROOF_OF_DELIVERY";
  if (upper.includes("CARRIER_INVOICE")) return "CARRIER_INVOICE";
  return "OTHER";
};

const extractionSchema = z.object({
  documentType: z.preprocess(
    normalizeDocumentType,
    z.enum([
      "BILL_OF_LADING",
      "AIR_WAYBILL",
      "COMMERCIAL_INVOICE",
      "PACKING_LIST",
      "PROOF_OF_DELIVERY",
      "CARRIER_INVOICE",
      "BOOKING_REQUEST",
      "BOOKING_CONFIRMATION",
      "OTHER",
    ])
  ),
  confidence: z.preprocess(normalizeConfidence, z.number().min(0).max(100)),
  customerReference: nullableString,
  poReference: nullableString,
  shipperName: nullableString,
  consigneeName: nullableString,
  carrierName: nullableString,
  carrierCode: nullableString,
  mode: z.preprocess(normalizeMode, z.enum(["OCEAN", "AIR", "TRUCK", "RAIL", "DRAYAGE"]).nullable().default(null)),
  serviceLevel: nullableString,
  incoterm: nullableString,
  originName: nullableString,
  originCountry: nullableString,
  originUnlocode: nullableString,
  destinationName: nullableString,
  destinationCountry: nullableString,
  destinationUnlocode: nullableString,
  estimatedArrival: nullableString,
  customerPromiseDate: nullableString,
  lastFreeDay: nullableString,
  bookingNumber: nullableString,
  masterBillNumber: nullableString,
  houseBillNumber: nullableString,
  airWaybillNumber: nullableString,
  proNumber: nullableString,
  containerNumbers: z.array(z.string().trim().min(1)).default([]),
  equipmentTypes: z.array(z.string().trim().min(1)).default([]),
  commodityDescription: nullableString,
  packageCount: nullableNumber,
  totalWeight: nullableNumber,
  weightUnit: nullableString,
  totalVolume: nullableNumber,
  volumeUnit: nullableString,
  hazmat: z.boolean().nullable().default(null),
  temperatureRequirement: nullableString,
  rawMetadataJson: nullableString,
  lineItems: z
    .array(
      z.object({
        description: nullableString,
        quantity: nullableNumber,
        packingNumber: nullableString,
        weight: nullableNumber,
        volume: nullableNumber,
      })
    )
    .default([]),
  additionalFields: z
    .array(
      z.object({
        key: z.string().trim().min(1),
        value: z.string().trim().min(1),
        section: nullableString,
      })
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
  evidence: z
    .array(
      z.object({
        field: z.string(),
        value: z.string(),
        source: z.string(),
        confidence: z.number().min(0).max(100),
      })
    )
    .default([]),
});

export type TmsDocumentExtraction = z.infer<typeof extractionSchema>;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    documentType: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
    customerReference: { type: Type.STRING, nullable: true },
    poReference: { type: Type.STRING, nullable: true },
    shipperName: { type: Type.STRING, nullable: true },
    consigneeName: { type: Type.STRING, nullable: true },
    carrierName: { type: Type.STRING, nullable: true },
    carrierCode: { type: Type.STRING, nullable: true },
    mode: { type: Type.STRING, enum: ["OCEAN", "AIR", "TRUCK", "RAIL", "DRAYAGE"], nullable: true },
    serviceLevel: { type: Type.STRING, nullable: true },
    incoterm: { type: Type.STRING, nullable: true },
    originName: { type: Type.STRING, nullable: true },
    originCountry: { type: Type.STRING, nullable: true },
    originUnlocode: { type: Type.STRING, nullable: true },
    destinationName: { type: Type.STRING, nullable: true },
    destinationCountry: { type: Type.STRING, nullable: true },
    destinationUnlocode: { type: Type.STRING, nullable: true },
    estimatedArrival: { type: Type.STRING, nullable: true },
    customerPromiseDate: { type: Type.STRING, nullable: true },
    lastFreeDay: { type: Type.STRING, nullable: true },
    bookingNumber: { type: Type.STRING, nullable: true },
    masterBillNumber: { type: Type.STRING, nullable: true },
    houseBillNumber: { type: Type.STRING, nullable: true },
    airWaybillNumber: { type: Type.STRING, nullable: true },
    proNumber: { type: Type.STRING, nullable: true },
    containerNumbers: { type: Type.ARRAY, items: { type: Type.STRING } },
    equipmentTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
    commodityDescription: { type: Type.STRING, nullable: true },
    packageCount: { type: Type.NUMBER, nullable: true },
    totalWeight: { type: Type.NUMBER, nullable: true },
    weightUnit: { type: Type.STRING, nullable: true },
    totalVolume: { type: Type.NUMBER, nullable: true },
    volumeUnit: { type: Type.STRING, nullable: true },
    hazmat: { type: Type.BOOLEAN, nullable: true },
    temperatureRequirement: { type: Type.STRING, nullable: true },
    rawMetadataJson: { type: Type.STRING, nullable: true },
    lineItems: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING, nullable: true },
          quantity: { type: Type.NUMBER, nullable: true },
          packingNumber: { type: Type.STRING, nullable: true },
          weight: { type: Type.NUMBER, nullable: true },
          volume: { type: Type.NUMBER, nullable: true },
        },
      },
    },
    additionalFields: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          key: { type: Type.STRING },
          value: { type: Type.STRING },
          section: { type: Type.STRING, nullable: true },
        },
        required: ["key", "value"],
      },
    },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING },
          value: { type: Type.STRING },
          source: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
        required: ["field", "value", "source", "confidence"],
      },
    },
  },
  required: ["documentType", "confidence", "containerNumbers", "equipmentTypes", "lineItems", "additionalFields", "warnings", "evidence"],
};

const EXTRACTION_PROMPT = `You are Qubere's freight document intake agent.
CRITICAL MANDATE — ZERO DATA LOSS:
Read the attached logistics document and extract EVERYTHING present in it.
Never invent data, but NEVER discard or omit any label, field, contact, line item, table cell, instruction, address, or date visible anywhere on the document.
1. Populate standard freight fields (Shipper, Consignee, Carrier, Mode, Booking #, Origin, Destination, etc.).
2. In rawMetadataJson, supply a valid JSON string mapping EVERY SINGLE label, header, contact name, phone, email, reference number, date (CutOff, ETD, ETA), vessel/voyage, move type (FCL/FCL), loading type, delivery location, line item quantity, packing number, and cargo description visible anywhere on the document directly to its value.
Document types are BILL_OF_LADING, AIR_WAYBILL, COMMERCIAL_INVOICE, PACKING_LIST, PROOF_OF_DELIVERY, CARRIER_INVOICE, BOOKING_REQUEST, BOOKING_CONFIRMATION, or OTHER.
Mode must be one of: OCEAN, AIR, TRUCK, RAIL, DRAYAGE, or null.
Confidence must be an integer percentage score between 0 and 100 (e.g. 95 for 95%).
Evidence.source must identify the visible label, table, or page containing each value.
Warnings must call out conflicts, illegible content, and fields that are operationally important but absent.`;

async function loadDocumentBytes(fileUrl: string): Promise<Buffer> {
  if (/^https:\/\//i.test(fileUrl)) {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const response = await fetch(fileUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Stored document could not be read (${response.status}).`);
    return Buffer.from(await response.arrayBuffer());
  }

  if (!fileUrl.startsWith("/uploads/")) {
    throw new Error("Document storage reference is not supported by the TMS worker.");
  }

  const relative = fileUrl.replace(/^\/+/, "");
  if (relative.includes("..")) throw new Error("Invalid document storage reference.");
  const candidates = [
    path.join(process.cwd(), "public", relative),
    path.join(process.cwd(), "apps", "tms", "public", relative),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(/* turbopackIgnore: true */ candidate);
    } catch {
      // Try the next valid app-relative location.
    }
  }
  throw new Error("Stored document bytes are unavailable.");
}

async function parseWithDoclingIfAvailable(fileName: string, mimeType: string, bytes: Buffer): Promise<string | null> {
  const baseUrl = process.env.DOCLING_API_BASE_URL;
  const apiKey = process.env.DOCLING_API_KEY;
  if (!baseUrl || !apiKey) return null;

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(bytes)], { type: mimeType || "application/pdf" });
    formData.append("files", blob, fileName);

    const submitUrl = `${baseUrl.replace(/\/+$/, "")}/v1/convert/file/async`;
    const submitRes = await fetch(submitUrl, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!submitRes.ok) return null;
    const submitJson = await submitRes.json();
    const taskId = submitJson.task_id || submitJson.id;
    if (!taskId) return null;

    const pollUrl = `${baseUrl.replace(/\/+$/, "")}/v1/status/poll/${taskId}`;
    const startTime = Date.now();
    while (Date.now() - startTime < 12000) {
      const pollRes = await fetch(pollUrl, {
        headers: { "X-Api-Key": apiKey },
      });
      if (!pollRes.ok) break;
      const statusJson = await pollRes.json();
      const statusStr = String(statusJson.status || statusJson.task_status || "").toUpperCase();
      if (statusStr === "SUCCESS" || statusStr === "COMPLETED" || statusStr === "FINISHED") {
        const resultUrl = `${baseUrl.replace(/\/+$/, "")}/v1/result/${taskId}`;
        const resultRes = await fetch(resultUrl, {
          headers: { "X-Api-Key": apiKey },
        });
        if (resultRes.ok) {
          const resultJson = await resultRes.json();
          const docObj = resultJson.documents?.[0] || resultJson.document;
          const markdownArtifact = docObj?.artifacts?.find((a: any) => a.artifact_type === "markdown" || a.mime_type === "text/markdown");
          if (markdownArtifact?.uri) {
            const mdRes = await fetch(markdownArtifact.uri);
            if (mdRes.ok) return await mdRes.text();
          }
          const directMd = docObj?.export?.markdown || resultJson.markdown;
          if (directMd) return String(directMd);
        }
        break;
      }
      if (statusStr === "FAILURE" || statusStr === "FAILED") break;
      await new Promise((r) => setTimeout(r, 600));
    }
  } catch (err) {
    console.warn("[documentFreightExtraction] Docling pre-parsing fallback:", err);
  }
  return null;
}

export async function extractFreightDocument(input: {
  fileName: string;
  fileUrl: string | null;
  mimeType: string | null;
}): Promise<
  | { configured: false; blocker: string }
  | { configured: true; model: string; extraction: TmsDocumentExtraction }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      configured: false,
      blocker: "GEMINI_API_KEY is not configured. The document is safely stored, but freight extraction requires human review.",
    };
  }
  if (!input.fileUrl) throw new Error("The document has no stored file reference.");

  const bytes = await loadDocumentBytes(input.fileUrl);
  const doclingMarkdown = await parseWithDoclingIfAvailable(input.fileName, input.mimeType || "application/pdf", bytes);

  const rawModel = process.env.TMS_DOCUMENT_MODEL || process.env.GEMINI_MODEL || "";
  const model = rawModel || "gemini-3.6-flash";
  const client = new GoogleGenAI({ apiKey });
  try {
    const promptText = doclingMarkdown
      ? `${EXTRACTION_PROMPT}\nFile name: ${input.fileName}\n\nIBM Docling Parsed Document Content:\n${doclingMarkdown}`
      : `${EXTRACTION_PROMPT}\nFile name: ${input.fileName}`;

    const response = await client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: input.mimeType || "application/pdf",
                data: bytes.toString("base64"),
              },
            },
            { text: promptText },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1,
      },
    });

    const parsed = extractionSchema.safeParse(JSON.parse(response.text || "{}"));
    if (!parsed.success) {
      throw new Error(`Freight extraction failed quality validation: ${parsed.error.issues[0]?.message || "invalid output"}`);
    }

    return { configured: true, model, extraction: parsed.data };
  } catch (err: any) {
    console.warn(`[documentFreightExtraction] AI extraction exception: ${err?.message || err}`);
    return {
      configured: false,
      blocker: `AI extraction provider unavailable (${err?.message || "Invalid API key or service error"}). The document is safely stored for dispatcher review.`,
    };
  }
}

export function parseStoredFreightExtraction(raw: string | null): TmsDocumentExtraction | null {
  if (!raw) return null;
  try {
    const parsed = extractionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const data = parsed.data;
    const hasAnyContent = Boolean(
      data.customerReference ||
      data.poReference ||
      data.shipperName ||
      data.consigneeName ||
      data.carrierName ||
      data.carrierCode ||
      data.mode ||
      data.serviceLevel ||
      data.incoterm ||
      data.originName ||
      data.originCountry ||
      data.originUnlocode ||
      data.destinationName ||
      data.destinationCountry ||
      data.destinationUnlocode ||
      data.estimatedArrival ||
      data.customerPromiseDate ||
      data.lastFreeDay ||
      data.bookingNumber ||
      data.masterBillNumber ||
      data.houseBillNumber ||
      data.airWaybillNumber ||
      data.proNumber ||
      data.commodityDescription ||
      data.packageCount !== null ||
      data.totalWeight !== null ||
      data.totalVolume !== null ||
      data.hazmat !== null ||
      data.temperatureRequirement ||
      data.rawMetadataJson ||
      data.containerNumbers.length > 0 ||
      data.equipmentTypes.length > 0 ||
      data.lineItems.length > 0 ||
      data.additionalFields.length > 0
    );
    return hasAnyContent ? data : null;
  } catch {
    return null;
  }
}
