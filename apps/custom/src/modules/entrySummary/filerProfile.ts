/**
 * Filer Profile model and registry (U2).
 *
 * C7 — filer-agnostic via profiles: export format/transport details live in a
 * data record (FilerProfile), never hardcoded in a serializer. This module is
 * the service-boundary validation + lookup layer over that table.
 */

import { z } from "zod";
import type { db as Db } from "@/lib/db";

export const FILER_PROFILE_FORMATS = ["CSV", "CATAIR_AE", "JSON_API"] as const;
export type FilerProfileFormat = (typeof FILER_PROFILE_FORMATS)[number];

const filerCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{3}$/, "Filer code must be exactly 3 characters, [A-Z0-9].");

const portCodeSchema = z.string().regex(/^\d{4}$/, "Port code must be exactly 4 digits.");

/** Any key matching this may only ever be a non-secret ref, never a plain value. */
const SECRET_LIKE_KEY = /pass|secret|token|key|credential/i;

export class SecretInTransportConfigError extends Error {
  constructor(readonly key: string) {
    super(
      `transportConfig key "${key}" looks like a secret (matches /pass|secret|token|key|credential/i) ` +
        `and is not a "secretRef" pointer. Store the secret elsewhere and reference it by secretRef.`
    );
    this.name = "SecretInTransportConfigError";
  }
}

/**
 * Rejects a transportConfig whose JSON contains any key matching
 * /pass|secret|token|key|credential/i holding a plain string value, unless
 * that key is literally "secretRef" — the only key allowed to carry
 * secret-shaped content (a pointer to a vault, never the secret itself).
 */
export function assertNoInlineSecrets(transportConfig: unknown, path: string[] = []): void {
  if (transportConfig == null || typeof transportConfig !== "object") return;
  for (const [key, value] of Object.entries(transportConfig as Record<string, unknown>)) {
    if (key !== "secretRef" && SECRET_LIKE_KEY.test(key) && typeof value === "string") {
      throw new SecretInTransportConfigError([...path, key].join("."));
    }
    if (value != null && typeof value === "object") {
      assertNoInlineSecrets(value, [...path, key]);
    }
  }
}

export const filerProfileInputSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1),
  filerCode: filerCodeSchema,
  defaultPortCode: portCodeSchema.optional().nullable(),
  format: z.enum(FILER_PROFILE_FORMATS),
  formatVersion: z.string().min(1),
  fieldMap: z.record(z.string(), z.unknown()),
  transport: z.string().min(1),
  transportConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  active: z.boolean().optional(),
});

export type FilerProfileInput = z.infer<typeof filerProfileInputSchema>;

export interface FilerProfileRecord {
  id: string;
  accountId: string;
  name: string;
  filerCode: string;
  defaultPortCode: string | null;
  format: string;
  formatVersion: string;
  fieldMap: unknown;
  transport: string;
  transportConfig: unknown;
  active: boolean;
}

export class NoFilerProfileConfigured extends Error {
  constructor(readonly accountId: string, readonly format?: string) {
    super(
      format
        ? `No active FilerProfile configured for account ${accountId} in format ${format}.`
        : `No active FilerProfile configured for account ${accountId}.`
    );
    this.name = "NoFilerProfileConfigured";
  }
}

export class AmbiguousFilerProfile extends Error {
  constructor(readonly accountId: string, readonly candidateNames: string[], readonly format?: string) {
    super(
      `Account ${accountId} has ${candidateNames.length} active FilerProfiles` +
        `${format ? ` in format ${format}` : ""} (${candidateNames.slice().sort().join(", ")}). ` +
        `Deactivate all but one, or pass a format to disambiguate.`
    );
    this.name = "AmbiguousFilerProfile";
  }
}

/** Validates a create/update payload before it is persisted. Throws on any violation. */
export function validateFilerProfileInput(input: unknown): FilerProfileInput {
  const parsed = filerProfileInputSchema.parse(input);
  assertNoInlineSecrets(parsed.transportConfig ?? null);
  return parsed;
}

/**
 * Returns exactly one active FilerProfile for the account (optionally scoped
 * to a format), or a typed error. Never falls back to a built-in default (C2).
 */
export async function getActiveProfile(
  db: Pick<typeof Db, "filerProfile">,
  accountId: string,
  format?: FilerProfileFormat
): Promise<FilerProfileRecord> {
  const candidates = (await db.filerProfile.findMany({
    where: { accountId, active: true, ...(format ? { format } : {}) },
  })) as FilerProfileRecord[];

  if (candidates.length === 0) throw new NoFilerProfileConfigured(accountId, format);
  if (candidates.length > 1) {
    throw new AmbiguousFilerProfile(
      accountId,
      candidates.map((c) => c.name),
      format
    );
  }
  return candidates[0];
}

/** Cross-account-safe single-record read: never returns a row from another account. */
export async function getProfileById(
  db: Pick<typeof Db, "filerProfile">,
  accountId: string,
  id: string
): Promise<FilerProfileRecord | null> {
  const record = (await db.filerProfile.findFirst({ where: { id, accountId } })) as FilerProfileRecord | null;
  return record ?? null;
}
