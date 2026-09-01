import { z } from "zod";

export const AGENCIES = ["FDA", "USDA", "EPA", "FWS", "CPSC", "NHTSA"] as const;
export const OPEN_HOLD_STATUSES = ["Open", "Submitted", "Processing", "Rejected"] as const;
export const holdNoticeSchema = z.object({
  shipmentId: z.string().min(1).max(100),
  externalKey: z.string().trim().min(1).max(200),
  agencyCode: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9/]{1,15}$/),
  holdCode: z.string().trim().min(1).max(40),
  reasonText: z.string().trim().min(1).max(2000),
  rawNotice: z.string().trim().min(1).max(100000),
  commodityLineRef: z.string().trim().regex(/^[1-9][0-9]{0,8}$/).optional(),
  issuedAt: z.iso.datetime({ offset: true }),
}).strict();
export const holdDraftSchema = z.object({
  version: z.number().int().nonnegative(),
  formInput: z.record(z.string().max(80), z.string().max(2000)).refine(v => Object.keys(v).length <= 80, "Too many fields"),
}).strict();
export const holdSubmitSchema = holdDraftSchema.extend({
  filedManually: z.literal(true),
  externalReference: z.string().trim().min(1).max(200),
  messageSetText: z.string().min(1).max(100000),
}).strict();
export const holdResponseSchema = z.object({
  version: z.number().int().nonnegative(),
  submissionId: z.string().min(1),
  status: z.enum(["Processing", "Released", "Rejected"]),
  responseCode: z.string().trim().min(1).max(40),
  reason: z.string().trim().min(1).max(2000),
  rawResponse: z.string().trim().min(1).max(100000),
  rejectedFields: z.array(z.string().max(80)).max(80).default([]),
  responseAt: z.iso.datetime({ offset: true }),
}).strict();
export type HoldNoticeInput = z.infer<typeof holdNoticeSchema>;
export type HoldFormInput = z.infer<typeof holdDraftSchema>["formInput"];

export type PreparationField = { id: string; label: string; required?: boolean; type?: "date" | "number"; maxLength?: number };
const common: PreparationField[] = [
  { id: "importer", label: "Importer of record", required: true },
  { id: "manufacturer", label: "Manufacturer" },
  { id: "countryOfOrigin", label: "Country of origin" },
  { id: "description", label: "Commodity description", required: true },
  { id: "htsCode", label: "HTS code" },
  { id: "quantity", label: "Quantity", type: "number" },
  { id: "unitOfMeasure", label: "Unit of measure" },
  { id: "portOfEntry", label: "Port of entry" },
];
const agencyFields: Record<string, PreparationField[]> = {
  FDA: [{ id: "productCode", label: "FDA product code" }, { id: "intendedUse", label: "Intended use" }, { id: "arrivalDate", label: "Anticipated arrival date", type: "date" }, { id: "lotNumber", label: "Lot / batch number" }],
  USDA: [{ id: "program", label: "Lacey Act / phytosanitary program" }, { id: "scientificName", label: "Species scientific name" }, { id: "certificateNumber", label: "Certificate reference" }],
  EPA: [{ id: "program", label: "TSCA / vehicle compliance program" }, { id: "certification", label: "Certification reference" }],
  FWS: [{ id: "scientificName", label: "Species scientific name" }, { id: "wildlifeDeclaration", label: "Wildlife declaration reference" }],
  CPSC: [{ id: "certificateNumber", label: "Certificate of compliance reference" }, { id: "testingLaboratory", label: "Testing laboratory" }],
  NHTSA: [{ id: "vin", label: "Vehicle identification number" }, { id: "complianceBasis", label: "Safety compliance basis" }],
};
export function getPreparationFields(agencyCode: string): PreparationField[] | null {
  return agencyFields[agencyCode] ? [...common, ...agencyFields[agencyCode]] : null;
}
/** Preparation validation only. These are not approved regulatory message-set matrices. */
export function validatePreparation(agencyCode: string, input: HoldFormInput) {
  const errors: Record<string, string> = {};
  for (const field of getPreparationFields(agencyCode) ?? []) {
    const value = input[field.id]?.trim() ?? "";
    if (field.required && !value) errors[field.id] = "Enter " + field.label.toLowerCase() + ".";
    if (value && field.type === "number" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) errors[field.id] = "Enter a positive number.";
    if (value && field.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) errors[field.id] = "Enter a valid date.";
  }
  return errors;
}
export function restoreHoldDraft(input: unknown, updatedAt: Date | null, now = new Date()): HoldFormInput | null {
  if (!updatedAt || now.getTime() - updatedAt.getTime() > 86400000) return null;
  const parsed = holdDraftSchema.shape.formInput.safeParse(input);
  return parsed.success ? parsed.data : null;
}
