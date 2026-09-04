import { describe, it, expect } from "vitest";
import { resolveStorageOrigin, StorageValidationError } from "@/lib/storage";

describe("Storage origin allowlist (file proxy hardening)", () => {
  it("rejects non-Cloud-Storage remote hosts", () => {
    expect(() =>
      resolveStorageOrigin("https://abc123.public.blob.vercel-storage.com/documents/inv.pdf")
    ).toThrow(StorageValidationError);
    expect(() => resolveStorageOrigin("https://some-object-store.example.com/inv.pdf")).toThrow(
      StorageValidationError
    );
  });

  it("treats local upload paths as non-remote so no credential is attached", () => {
    expect(resolveStorageOrigin("/uploads/1234-invoice.pdf")).toBeNull();
  });

  it("accepts only objects in the configured Google Cloud Storage bucket", () => {
    const originalBucket = process.env.GCS_BUCKET;
    process.env.GCS_BUCKET = "qubere-demo-documents";
    try {
      expect(
        resolveStorageOrigin(
          "https://storage.googleapis.com/qubere-demo-documents/documents/inv.pdf"
        )
      ).toBe("gcs");
      expect(() =>
        resolveStorageOrigin(
          "https://storage.googleapis.com/attacker-controlled/documents/inv.pdf"
        )
      ).toThrow(StorageValidationError);
    } finally {
      if (originalBucket === undefined) delete process.env.GCS_BUCKET;
      else process.env.GCS_BUCKET = originalBucket;
    }
  });

  it("rejects hosts that merely contain the allowlisted domain as a substring", () => {
    const bypasses = [
      "https://attacker.com/storage.googleapis.com",
      "https://attacker.com/?x=storage.googleapis.com",
      "https://storage.googleapis.com.attacker.com/steal",
      "https://attacker.com#storage.googleapis.com",
    ];

    for (const url of bypasses) {
      expect(() => resolveStorageOrigin(url), url).toThrow(StorageValidationError);
    }
  });

  it("rejects non-https schemes and internal metadata endpoints", () => {
    expect(() => resolveStorageOrigin("http://storage.googleapis.com/x")).toThrow(
      StorageValidationError
    );
    expect(() => resolveStorageOrigin("http://169.254.169.254/latest/meta-data/")).toThrow(
      StorageValidationError
    );
    expect(() => resolveStorageOrigin("file:///etc/passwd")).toThrow(StorageValidationError);
  });

  it("rejects malformed URLs", () => {
    expect(() => resolveStorageOrigin("not a url")).toThrow(StorageValidationError);
  });
});
