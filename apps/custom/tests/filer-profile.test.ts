import { describe, expect, it } from "vitest";

import {
  AmbiguousFilerProfile,
  NoFilerProfileConfigured,
  assertNoInlineSecrets,
  getActiveProfile,
  getProfileById,
  validateFilerProfileInput,
} from "@/modules/entrySummary/filerProfile";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    accountId: "acct_1",
    name: "Primary CSV filer",
    filerCode: "ABC",
    format: "CSV",
    formatVersion: "1.0",
    fieldMap: {},
    transport: "SFTP",
    ...overrides,
  };
}

describe("filer code validation", () => {
  it("accepts a valid 3-char [A-Z0-9] code", () => {
    expect(() => validateFilerProfileInput(validInput({ filerCode: "ABC" }))).not.toThrow();
  });

  it.each(["AB", "ABCD", "ab c"])("rejects %s", (filerCode) => {
    expect(() => validateFilerProfileInput(validInput({ filerCode }))).toThrow();
  });
});

describe("default port code validation", () => {
  it("accepts a 4-digit code", () => {
    expect(() => validateFilerProfileInput(validInput({ defaultPortCode: "2704" }))).not.toThrow();
  });

  it.each(["270", "27040", "LA"])("rejects %s", (defaultPortCode) => {
    expect(() => validateFilerProfileInput(validInput({ defaultPortCode }))).toThrow();
  });
});

describe("transportConfig secret guard", () => {
  it("rejects a plain password value", () => {
    expect(() => assertNoInlineSecrets({ password: "hunter2" })).toThrow();
    expect(() => validateFilerProfileInput(validInput({ transportConfig: { password: "hunter2" } }))).toThrow();
  });

  it("accepts a secretRef pointer alongside plain config", () => {
    expect(() => assertNoInlineSecrets({ host: "sftp.x.com", secretRef: "vault://filer/x" })).not.toThrow();
    expect(() => validateFilerProfileInput(validInput({ transportConfig: { host: "sftp.x.com", secretRef: "vault://filer/x" } }))).not.toThrow();
  });

  it("rejects any other secret-shaped key (token, apiKey, credential)", () => {
    expect(() => assertNoInlineSecrets({ apiToken: "abc123" })).toThrow();
    expect(() => assertNoInlineSecrets({ credential: "xyz" })).toThrow();
  });
});

function makeDb(profiles: Array<{ id: string; accountId: string; active: boolean; format: string; name: string }>) {
  return {
    filerProfile: {
      findMany: async ({ where }: { where: { accountId: string; active: boolean; format?: string } }) =>
        profiles.filter(
          (p) => p.accountId === where.accountId && p.active === where.active && (!where.format || p.format === where.format)
        ),
      findFirst: async ({ where }: { where: { id: string; accountId: string } }) =>
        profiles.find((p) => p.id === where.id && p.accountId === where.accountId) ?? null,
    },
  } as any;
}

describe("getActiveProfile", () => {
  it("returns NoFilerProfileConfigured (not a raw error, not a default) when zero active profiles exist", async () => {
    const db = makeDb([]);
    await expect(getActiveProfile(db, "acct_1")).rejects.toBeInstanceOf(NoFilerProfileConfigured);
  });

  it("returns a deterministic AmbiguousFilerProfile naming both profiles for two active CSV profiles", async () => {
    const db = makeDb([
      { id: "p1", accountId: "acct_1", active: true, format: "CSV", name: "Filer A" },
      { id: "p2", accountId: "acct_1", active: true, format: "CSV", name: "Filer B" },
    ]);
    await expect(getActiveProfile(db, "acct_1", "CSV")).rejects.toBeInstanceOf(AmbiguousFilerProfile);
    try {
      await getActiveProfile(db, "acct_1", "CSV");
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("Filer A");
      expect((err as Error).message).toContain("Filer B");
    }
  });

  it("returns exactly one profile when unambiguous", async () => {
    const db = makeDb([{ id: "p1", accountId: "acct_1", active: true, format: "CSV", name: "Filer A" }]);
    const result = await getActiveProfile(db, "acct_1", "CSV");
    expect(result.id).toBe("p1");
  });
});

describe("cross-account isolation", () => {
  it("account A cannot read account B's profile by id", async () => {
    const db = makeDb([{ id: "p1", accountId: "acct_B", active: true, format: "CSV", name: "B's filer" }]);
    const result = await getProfileById(db, "acct_A", "p1");
    expect(result).toBeNull();
  });
});
