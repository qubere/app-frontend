import { GoogleGenAI, Type } from "@google/genai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const nullableString = z.string().trim().min(1).nullable().default(null);
const nullableNumber = z.number().finite().nullable().default(null);

const extractionSchema = z.object({
  documentType: z.enum([
    "BILL_OF_LADING",
    "AIR_WAYBILL",
    "COMMERCIAL_INVOICE",
    "PACKING_LIST",
    "PROOF_OF_DELIVERY",
    "CARRIER_INVOICE",
    "OTHER",
  ]),
  confidence: z.number().min(0).max(100),
  customerReference: nullableString,
  poReference: nullableString,
  shipperName: nullableString,
  consigneeName: nullableString,
  carrierName: nullableString,
  carrierCode: nullableString,
  mode: z.enum(["OCEAN", "AIR", "TRUCK", "RAIL", "DRAYAGE"]).nullable().default(null),
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
    mode: { type: Type.STRING, nullable: true },
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
  required: ["documentType", "confidence", "containerNumbers", "equipmentTypes", "warnings", "evidence"],
};

const EXTRACTION_PROMPT = `You are Qubere's freight document intake agent.
Read the attached logistics document and return only facts explicitly present in it.
Never invent a carrier, route, date, reference, amount, equipment type, or status.
Use ISO-8601 for dates when the document supplies enough information; otherwise return null.
Use ISO country codes and UN/LOCODEs only when explicit or unambiguous from a named port.
Document types are BILL_OF_LADING, AIR_WAYBILL, COMMERCIAL_INVOICE, PACKING_LIST,
PROOF_OF_DELIVERY, CARRIER_INVOICE, or OTHER.
Evidence.source must identify the visible label, table, or page containing each value.
Warnings must call out conflicts, illegible content, and fields that are operationally important but absent.`;

async function loadDocumentBytes(fileUrl: string): Promise<Buffer> {
  if (/^https:\/\//i.test(fileUrl)) {
    const response = await fetch(fileUrl, { cache: "no-store" });
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
  const model = process.env.TMS_DOCUMENT_MODEL || "gemini-2.5-flash";
  const client = new GoogleGenAI({ apiKey });
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
          { text: `${EXTRACTION_PROMPT}\nFile name: ${input.fileName}` },
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
}

export function parseStoredFreightExtraction(raw: string | null): TmsDocumentExtraction | null {
  if (!raw) return null;
  try {
    const parsed = extractionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
