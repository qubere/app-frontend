import { describe, it, expect } from "vitest";
import { normalizeSenderEmail, recipientMatches, parseSenderNameAndEmail } from "@/modules/inbound/emailNormalization";

describe("inbound email normalization", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeSenderEmail("  jane@acme.com  ")).toBe("jane@acme.com");
  });

  it("lowercases the whole address", () => {
    expect(normalizeSenderEmail("Jane.Doe@ACME.COM")).toBe("jane.doe@acme.com");
  });

  it("does not collapse Gmail dots", () => {
    // Two distinct-looking addresses must stay distinct: Gmail's own dot-
    // insensitivity is not this system's business to reimplement, since
    // doing so would let one authorized sender's route silently also match
    // an address nobody explicitly authorized.
    expect(normalizeSenderEmail("j.a.n.e@gmail.com")).not.toBe(normalizeSenderEmail("jane@gmail.com"));
  });

  it("does not strip plus-tags", () => {
    expect(normalizeSenderEmail("jane+invoices@acme.com")).not.toBe(normalizeSenderEmail("jane@acme.com"));
  });

  it("does not rewrite aliases", () => {
    expect(normalizeSenderEmail("jane+billing@acme.com")).not.toBe(normalizeSenderEmail("jane+invoices@acme.com"));
  });

  describe("recipientMatches", () => {
    it("matches after normalizing the candidate", () => {
      expect(recipientMatches("  Docs@Inbound.Qubere.AI  ", "docs@inbound.qubere.ai")).toBe(true);
    });

    it("rejects a different local part on the same domain", () => {
      expect(recipientMatches("random@inbound.qubere.ai", "docs@inbound.qubere.ai")).toBe(false);
    });
  });

  describe("parseSenderNameAndEmail", () => {
    it("extracts display name and email when both are present", () => {
      expect(parseSenderNameAndEmail('"Jane Lohani" <janeilohani@gmail.com>')).toEqual({
        displayName: "Jane Lohani",
        email: "janeilohani@gmail.com",
        nameOrEmail: "Jane Lohani",
      });
      expect(parseSenderNameAndEmail("Jane Lohani <janeilohani@gmail.com>")).toEqual({
        displayName: "Jane Lohani",
        email: "janeilohani@gmail.com",
        nameOrEmail: "Jane Lohani",
      });
    });

    it("falls back to email when display name is missing or angle brackets only", () => {
      expect(parseSenderNameAndEmail("<janeilohani@gmail.com>")).toEqual({
        displayName: null,
        email: "janeilohani@gmail.com",
        nameOrEmail: "janeilohani@gmail.com",
      });
      expect(parseSenderNameAndEmail("janeilohani@gmail.com")).toEqual({
        displayName: null,
        email: "janeilohani@gmail.com",
        nameOrEmail: "janeilohani@gmail.com",
      });
    });

    it("handles null or empty inputs", () => {
      expect(parseSenderNameAndEmail(null)).toEqual({
        displayName: null,
        email: null,
        nameOrEmail: null,
      });
    });
  });
});
