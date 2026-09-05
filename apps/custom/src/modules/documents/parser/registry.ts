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
import { selectedProviderId, selectedFallbackProviderId } from "./config";
import { IbmHostedDoclingProvider } from "./ibm/ibmHostedDoclingProvider";
import { MockDoclingProvider } from "./mock/mockDoclingProvider";
import { FallbackDoclingProvider } from "./fallbackProvider";
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

  let primary: DocumentParserProvider;
  if (id === "mock") {
    if (!isMockParserAllowed()) {
      throw new DocumentParserError(
        "PARSER_NOT_CONFIGURED",
        `DOCUMENT_PARSER_PROVIDER=mock is only permitted on a local development machine (detected tier: ${deploymentTier()}). Set DOCUMENT_PARSER_PROVIDER=ibm-docling and configure DOCLING_API_BASE_URL / DOCLING_API_KEY.`
      );
    }
    primary = new MockDoclingProvider();
  } else {
    primary = new IbmHostedDoclingProvider();
  }

  const fallbackId = selectedFallbackProviderId();
  if (fallbackId === "none") {
    return primary;
  }

  if (fallbackId === "mock") {
    if (deploymentTier() !== "local") {
      throw new DocumentParserError(
        "PARSER_NOT_CONFIGURED",
        `DOCUMENT_PARSER_FALLBACK=mock is only permitted on a local development machine (detected tier: ${deploymentTier()}).`
      );
    }
    return new FallbackDoclingProvider(primary, new MockDoclingProvider());
  }

  // fallbackId === "gemini-vision": the class supports a real backup provider,
  // but no Gemini Vision parser adapter is wired yet. Refuse loudly rather than
  // silently running with no fallback the operator asked for.
  throw new DocumentParserError(
    "PARSER_NOT_CONFIGURED",
    "DOCUMENT_PARSER_FALLBACK=gemini-vision is not yet supported (no Gemini Vision parser adapter). Use DOCUMENT_PARSER_FALLBACK=mock (local only) or unset it."
  );
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
