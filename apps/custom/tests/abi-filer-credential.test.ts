import { describe, it, expect } from "vitest";
import { RealAceProvider } from "@/lib/filing/transmissionProvider";
import { NotImplSecretStoreResolver, type SecretStoreResolver } from "@/lib/filing/abiCredentialResolver";

/**
 * Test suite for P2: Per-customer ABI filer credential model & resolution interface.
 */

describe("P2 AbiFilerCredential Model & RealAceProvider Credentials", () => {
  describe("SecretStoreResolver Interface & Default Behavior", () => {
    it("throws an explicit error when using NotImplSecretStoreResolver default", async () => {
      const resolver = new NotImplSecretStoreResolver();
      await expect(resolver.resolveSecret("secret-pointer-123")).rejects.toThrow(
        'SecretStoreResolver: No external secret store configured to resolve secretRef "secret-pointer-123".'
      );
    });

    it("resolves secret string when custom SecretStoreResolver is injected", async () => {
      const mockResolver: SecretStoreResolver = {
        async resolveSecret(secretRef: string) {
          return `resolved_secret_for_${secretRef}`;
        },
      };

      const secret = await mockResolver.resolveSecret("ref-abc-789");
      expect(secret).toBe("resolved_secret_for_ref-abc-789");
    });
  });

  describe("RealAceProvider Per-Customer Construction & Methods", () => {
    it("initializes cleanly with per-customer credential configuration", () => {
      const provider = new RealAceProvider({
        credential: {
          filerCode: "9XY",
          secretRef: "vault/secrets/cbp-9xy",
          baseUrl: "https://sandbox.ace.cbp.dhs.gov/abi",
          environment: "SANDBOX",
          status: "ACTIVE",
        },
      });

      expect(provider.getFilerCode()).toBe("9XY");
      expect(provider.getBaseUrl()).toBe("https://sandbox.ace.cbp.dhs.gov/abi");
      expect(provider.getEnvironment()).toBe("SANDBOX");
      expect(provider.getStatusValue()).toBe("ACTIVE");
    });

    it("uses default baseUrl and SANDBOX environment when omitted", () => {
      const provider = new RealAceProvider({
        credential: {
          filerCode: "A12",
          secretRef: "secret_ref_a12",
        },
      });

      expect(provider.getFilerCode()).toBe("A12");
      expect(provider.getBaseUrl()).toBe("https://ace.cbp.dhs.gov/abi");
      expect(provider.getEnvironment()).toBe("SANDBOX");
    });

    it("resolves secret via injected resolver", async () => {
      const mockResolver: SecretStoreResolver = {
        async resolveSecret(secretRef: string) {
          return `SECRET_VAL_FOR_${secretRef}`;
        },
      };

      const provider = new RealAceProvider({
        credential: {
          filerCode: "B34",
          secretRef: "keyvault-ref-b34",
        },
        secretResolver: mockResolver,
      });

      const secret = await provider.getSecret();
      expect(secret).toBe("SECRET_VAL_FOR_keyvault-ref-b34");
    });

    it("throws when getSecret is called on an inactive credential", async () => {
      const provider = new RealAceProvider({
        credential: {
          filerCode: "C56",
          secretRef: "ref-c56",
          status: "INACTIVE",
        },
      });

      await expect(provider.getSecret()).rejects.toThrow("RealAceProvider: Filer credential status is INACTIVE.");
    });

    it("transmit() and getStatus() throw not-yet-implemented errors", async () => {
      const provider = new RealAceProvider({
        credential: {
          filerCode: "D78",
          secretRef: "ref-d78",
        },
      });

      await expect(
        provider.transmit({
          filingId: "f_1",
          entryNumber: "123-4567890-1",
          entryType: "01",
          portOfEntry: "3501",
          importerCbpNumber: "12-345678900",
          bondNumber: "BND123",
          countryOfExport: "CN",
          carrier: "MAEU",
          totalEnteredValue: 5000,
          totalDuty: 250,
          lineItems: [],
          builtAt: new Date().toISOString(),
        })
      ).rejects.toThrow("RealAceProvider.transmit is not yet implemented.");

      await expect(provider.getStatus("123-4567890-1")).rejects.toThrow(
        "RealAceProvider.getStatus is not yet implemented."
      );
    });
  });
});
