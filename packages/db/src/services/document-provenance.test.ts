import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
vi.mock("../index", () => ({ db: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { buildDocumentProvenance, resolveUploaderSnapshot } from "./document-provenance";

beforeEach(() => findUnique.mockReset());

describe("resolveUploaderSnapshot", () => {
  it("returns nulls when no userId is given", async () => {
    expect(await resolveUploaderSnapshot(null)).toEqual({ uploadedByName: null, uploadedByEmail: null });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("joins first/last name and carries the email", async () => {
    findUnique.mockResolvedValue({ firstName: "Dana", lastName: "Okafor", email: "dana@acme.com" });
    expect(await resolveUploaderSnapshot("u1")).toEqual({ uploadedByName: "Dana Okafor", uploadedByEmail: "dana@acme.com" });
  });

  it("falls back to email-only when the user has no name", async () => {
    findUnique.mockResolvedValue({ firstName: null, lastName: null, email: "x@y.com" });
    expect(await resolveUploaderSnapshot("u1")).toEqual({ uploadedByName: null, uploadedByEmail: "x@y.com" });
  });

  it("returns nulls when the user row is gone", async () => {
    findUnique.mockResolvedValue(null);
    expect(await resolveUploaderSnapshot("u1")).toEqual({ uploadedByName: null, uploadedByEmail: null });
  });
});

describe("buildDocumentProvenance", () => {
  it("snapshots the uploader from the userId and stamps uploadedAt", async () => {
    findUnique.mockResolvedValue({ firstName: "Dana", lastName: "Okafor", email: "dana@acme.com" });
    const p = await buildDocumentProvenance({
      channel: "WEB_APP",
      uploadedByType: "INTERNAL_USER",
      uploadedByUserId: "u1",
    });
    expect(p).toMatchObject({
      channel: "WEB_APP",
      uploadedByType: "INTERNAL_USER",
      uploadedByUserId: "u1",
      uploadedByName: "Dana Okafor",
      uploadedByEmail: "dana@acme.com",
    });
    expect(p.uploadedAt).toBeInstanceOf(Date);
    expect(p).not.toHaveProperty("channelMeta");
  });

  it("does not look up a user for email ingestion and keeps the explicit sender", async () => {
    const p = await buildDocumentProvenance({
      channel: "EMAIL",
      uploadedByType: "EMAIL_SENDER",
      uploadedByName: "porter@target.com",
      uploadedByEmail: "porter@target.com",
      channelMeta: { fromAddress: "porter@target.com", subject: "Invoice" },
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(p.uploadedByUserId).toBeNull();
    expect(p.uploadedByName).toBe("porter@target.com");
    expect(p.channelMeta).toEqual({ fromAddress: "porter@target.com", subject: "Invoice" });
  });

  it("prefers an explicit name/email over a lookup", async () => {
    const p = await buildDocumentProvenance({
      channel: "CUSTOMER_PORTAL",
      uploadedByType: "CUSTOMER_USER",
      uploadedByUserId: "u1",
      uploadedByName: "Explicit Name",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(p.uploadedByName).toBe("Explicit Name");
  });
});
