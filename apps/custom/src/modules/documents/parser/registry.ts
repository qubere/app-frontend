/**
 * Resolves the configured document parser provider.
 *
 * This is the single place a `DocumentParserProvider` is constructed, so the
 * production-safety rule is enforced once rather than trusted to every call
 * site:
 *
 *   - The mock provider serves traffic ONLY when `DOCUMENT_PARSER_PROVIDER=mock`
 *     is set explicitly AND the process is a local dev machine (`deploymentTier()
 *     === "local"`). On a demo or production deployment it is refused, loudly.
 *   - There is NO silent fallback from IBM Docling to the mock. A misconfigured
 *     or unreachable Docling surfaces as a failed run with a stated blocker, not
 *     as fabricated "mock" evidence. (The `FallbackDoclingProvider` class still
 *     exists for a deployment that opts into a real backup provider, but the
 *     registry no longer wires a mock backup.)
 */

import { DocumentParserError, type DocumentParserProvider } from "./contracts";
import { selectedProviderId } from "./config";
import { IbmHostedDoclingProvider } from "./ibm/ibmHostedDoclingProvider";
import { MockDoclingProvider } from "./mock/mockDoclingProvider";
import { deploymentTier } from "@/lib/environment";

/**
 * True only when the mock parser is a legitimate choice: explicitly selected and
 * running on a local dev machine. Exported for health reporting and the worker
 * start-up guard.
 */
export function isMockParserAllowed(): boolean {
  return selectedProviderId() === "mock" && deploymentTier() === "local";
}

export function getDocumentParserProvider(): DocumentParserProvider {
  const id = selectedProviderId();

  if (id === "none") {
    throw new DocumentParserError(
      "PARSER_NOT_CONFIGURED",
      "No document parser provider is configured. Set DOCUMENT_PARSER_PROVIDER=ibm-docling (deployed) or =mock (local development only)."
    );
  }

  if (id === "mock") {
    if (!isMockParserAllowed()) {
      throw new DocumentParserError(
        "PARSER_NOT_CONFIGURED",
        `DOCUMENT_PARSER_PROVIDER=mock is only permitted on a local development machine (detected tier: ${deploymentTier()}). Set DOCUMENT_PARSER_PROVIDER=ibm-docling and configure DOCLING_API_BASE_URL / DOCLING_API_KEY.`
      );
    }
    return new MockDoclingProvider();
  }

  // ibm-docling. The constructor reads and validates the config eagerly, so a
  // misconfiguration throws here (PARSER_NOT_CONFIGURED) rather than halfway
  // through a run — and is never swallowed by a fallback to a stand-in.
  return new IbmHostedDoclingProvider();
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
