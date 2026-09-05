import { describe, it, expect } from "vitest";
import { resolveOnboardingContact } from "@/lib/abi/importerCreate";

describe("resolveOnboardingContact", () => {
  it("prefers the 5106 payload contact block", () => {
    const result = resolveOnboardingContact({
      fiveOhSixPayload: { contact: { name: "Dana Ops", phone: "(415) 555-0142", email: "Dana@Northwind.com" } },
      client: { contactPhone: "212 555 9999", contactEmail: "ap@client.example" },
    });

    expect(result).toEqual({
      ok: true,
      phone: "4155550142",
      email: "dana@northwind.com",
      sources: { phone: "5106_contact", email: "5106_contact" },
    });
  });

  it("falls back through resident agent, officers, importer address, then client", () => {
    const result = resolveOnboardingContact({
      fiveOhSixPayload: { contact: { name: "", phone: "", email: "" } },
      residentAgent: { name: "Agent LLC", address: "1 Main St", phone: "305-555-7788" },
      officers: [{ phone: null, email: "cfo@acme.example" }],
      client: { contactPhone: null, contactEmail: null, billingContactEmail: "billing@acme.example" },
    });

    expect(result).toMatchObject({
      ok: true,
      phone: "3055557788",
      email: "cfo@acme.example",
      sources: { phone: "resident_agent", email: "officer_1" },
    });
  });

  it("rejects repdigit placeholder phones like 0000000000", () => {
    const result = resolveOnboardingContact({
      fiveOhSixPayload: { contact: { phone: "0000000000", email: "real@acme.example" } },
    });

    expect(result).toEqual({ ok: false, missing: ["phone"] });
  });

  it("rejects malformed emails and reports both missing when nothing is usable", () => {
    const result = resolveOnboardingContact({
      fiveOhSixPayload: { contact: { phone: "123", email: "not-an-email" } },
      officers: [],
      client: null,
    });

    expect(result).toEqual({ ok: false, missing: ["phone", "email"] });
  });

  it("does not synthesise an email from an account or client name", () => {
    const result = resolveOnboardingContact({
      fiveOhSixPayload: {},
      client: { contactPhone: "415 555 0100", contactEmail: null, billingContactEmail: null },
    });

    // Phone is real; email cannot be sourced -> blocked, never fabricated.
    expect(result).toEqual({ ok: false, missing: ["email"] });
  });

  it("accepts a full valid phone + email from the client record alone", () => {
    const result = resolveOnboardingContact({
      client: { contactPhone: "+1 (415) 555-0100", contactEmail: "ops@client.example" },
    });

    expect(result).toMatchObject({
      ok: true,
      phone: "14155550100",
      email: "ops@client.example",
      sources: { phone: "client_contact", email: "client_contact" },
    });
  });
});
