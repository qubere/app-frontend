/**
 * Interface and default implementation for resolving external secret pointers
 * (`secretRef`) into actual secret values (passwords/certificates) for CBP ABI transmission.
 */

export interface SecretStoreResolver {
  resolveSecret(secretRef: string): Promise<string>;
}

/**
 * Default resolver that throws an explicit error when no external secret store
 * integration is plugged in.
 */
export class NotImplSecretStoreResolver implements SecretStoreResolver {
  async resolveSecret(secretRef: string): Promise<string> {
    throw new Error(
      `SecretStoreResolver: No external secret store configured to resolve secretRef "${secretRef}".`
    );
  }
}
