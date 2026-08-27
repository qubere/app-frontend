/**
 * Resolves the configured document parser provider.
 *
 * This is the single place a `DocumentParserProvider` is constructed, so the
 * production-safety rule — a mock provider must never serve production traffic —
 * is enforced once rather than trusted to every call site.
 */

import { DocumentParserError, type DocumentParserProvider } from "./contracts";
import { selectedProviderId, type ParserProviderId } from "./config";
import { IbmHostedDoclingProvider } from "./ibm/ibmHostedDoclingProvider";
import { MockDoclingProvider } from "./mock/mockDoclingProvider";
import { FallbackDoclingProvider } from "./fallbackProvider";
import { isProductionEnvironment } from "@/lib/environment";

export function getDocumentParserProvider(): DocumentParserProvider {
  const id: ParserProviderId = selectedProviderId();

  if (id === "none") {
    throw new DocumentParserError(
      "PARSER_NOT_CONFIGURED",
      "No document parser provider is configured. Set DOCUMENT_PARSER_PROVIDER=ibm-docling (production) or =mock (local development)."
    );
  }

  if (id === "mock") {
    if (isProductionEnvironment()) {
      throw new DocumentParserError(
        "PARSER_NOT_CONFIGURED",
        "DOCUMENT_PARSER_PROVIDER=mock is not permitted in a production environment."
      );
    }
    return new MockDoclingProvider();
  }

  if (isProductionEnvironment()) {
    return new IbmHostedDoclingProvider();
  }

  let primaryProvider: DocumentParserProvider | null = null;
  try {
    primaryProvider = new IbmHostedDoclingProvider();
  } catch (err) {
    console.warn("[DocumentParser] Primary parser (ibm-docling) unconfigured, using backup parser:", err);
  }

  const backupProvider = new MockDoclingProvider();
  if (primaryProvider) {
    return new FallbackDoclingProvider(primaryProvider, backupProvider);
  }

  return backupProvider;
}

/** True when a provider can be resolved. Used by health reporting, not control flow. */
export function isDocumentParsingEnabled(): boolean {
  try {
    getDocumentParserProvider();
    return true;
  } catch {
    return false;
  }
}
