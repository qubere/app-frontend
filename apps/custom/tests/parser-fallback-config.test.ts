import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getDocumentParserProvider } from "../src/modules/documents/parser/registry";
import { FallbackDoclingProvider } from "../src/modules/documents/parser/fallbackProvider";
import { MockDoclingProvider } from "../src/modules/documents/parser/mock/mockDoclingProvider";

describe("DOCUMENT_PARSER_FALLBACK opt-in configuration", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it("returns primary provider directly when DOCUMENT_PARSER_FALLBACK is not set", () => {
    process.env.DOCUMENT_PARSER_PROVIDER = "mock";
    process.env.DEPLOYMENT_TIER = "local";
    delete process.env.DOCUMENT_PARSER_FALLBACK;

    const provider = getDocumentParserProvider();
    expect(provider).toBeInstanceOf(MockDoclingProvider);
    expect(provider).not.toBeInstanceOf(FallbackDoclingProvider);
  });

  it("wraps primary provider in FallbackDoclingProvider when DOCUMENT_PARSER_FALLBACK=mock in local tier", () => {
    process.env.DOCUMENT_PARSER_PROVIDER = "mock";
    process.env.DOCUMENT_PARSER_FALLBACK = "mock";
    delete process.env.APP_ENV;
    delete process.env.NEXT_PUBLIC_APP_ENV;
    delete process.env.DOCLING_API_BASE_URL;

    const provider = getDocumentParserProvider();
    expect(provider).toBeInstanceOf(FallbackDoclingProvider);
  });

  it("refuses DOCUMENT_PARSER_FALLBACK=mock in non-local deployment tier", () => {
    process.env.DOCUMENT_PARSER_PROVIDER = "ibm-docling";
    process.env.DOCUMENT_PARSER_FALLBACK = "mock";
    process.env.DEPLOYMENT_TIER = "production";
    process.env.DOCLING_API_BASE_URL = "https://docling.example.com";
    process.env.DOCLING_API_KEY = "test-key";

    expect(() => getDocumentParserProvider()).toThrow("DOCUMENT_PARSER_FALLBACK=mock is only permitted on a local development machine");
  });
});
