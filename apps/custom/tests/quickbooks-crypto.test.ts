import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/integrations/crypto";

describe("integration crypto (AES-256-GCM)", () => {
  beforeAll(() => {
    // 32 bytes, base64
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("round-trips a secret", () => {
    const token = "refresh-token-abc123.def456";
    const enc = encryptSecret(token);
    expect(enc).not.toContain(token);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe(token);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered ciphertext", () => {
    const enc = encryptSecret("sensitive");
    const parts = enc.split(":");
    const flipped = Buffer.from(parts[3], "base64");
    flipped[0] ^= 0xff;
    parts[3] = flipped.toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("rejects a malformed payload", () => {
    expect(() => decryptSecret("not-a-valid-payload")).toThrow();
  });

  it("isEncrypted is false for plaintext", () => {
    expect(isEncrypted("plain")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
  });
});
