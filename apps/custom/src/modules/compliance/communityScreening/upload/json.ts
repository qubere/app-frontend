import { z } from "zod";
import { normalizeCountry, trimToNull } from "@/modules/party/partyNormalization";
import type { CommunityScreeningPartyInput } from "../types";

const communityScreeningJsonRowSchema = z.object({
  partyId: z.string().optional().nullable(),
  externalReference: z.string().optional().nullable(),
  name: z.string(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
});

export const communityScreeningJsonArraySchema = z.array(communityScreeningJsonRowSchema).min(1);

export function parseCommunityScreeningJson(text: string): CommunityScreeningPartyInput[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("The uploaded file is not valid JSON");
  }

  const parsed = communityScreeningJsonArraySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid JSON row shape: ${parsed.error.message}`);
  }

  return parsed.data.map((row) => {
    const country = trimToNull(row.country ?? null);
    return {
      partyId: trimToNull(row.partyId ?? null),
      externalReference: trimToNull(row.externalReference ?? null),
      name: row.name,
      address: trimToNull(row.address ?? null),
      city: trimToNull(row.city ?? null),
      country: country ? normalizeCountry(country).code ?? country : null,
      contactName: trimToNull(row.contactName ?? null),
    };
  });
}
