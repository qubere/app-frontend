import { describe, expect, it } from "vitest";
import { serializeJson, ENTRY_SUMMARY_JSON_SCHEMA_VERSION } from "@/modules/entrySummary/serializers/json";
import { DraftNotExportable } from "@/modules/entrySummary/draft.service";
import type { ValidationResult } from "@/modules/entrySummary/validation/engine";
import { buildDraft, buildFilerProfile, buildLine, money } from "./helpers/entrySummaryFixtures";

const fixedClock = () => new Date("2026-05-01T12:00:00.000Z");

function exportableValidation(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return { findings: [], blockingCount: 0, warningCount: 0, isExportable: true, ...overrides };
}

function baseOpts() {
  return { clock: fixedClock, shipmentId: "shp_1", draftId: "esd_1", draftVersion: 2 };
}

function sampleDraft() {
  return buildDraft(
    [buildLine(1, { B28_DESCRIPTION: "Widget", B32A_ENTERED_VALUE: money("1234.5") })],
    { B06_PORT_CODE: "2704", B35_TOTAL_ENTERED_VALUE: money("1234.50") }
  );
}

function deepScanForKey(value: unknown, key: string): boolean {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => deepScanForKey(v, key));
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === key) return true;
    if (deepScanForKey(v, key)) return true;
  }
  return false;
}

describe("serializeJson", () => {
  it("1. schemaVersion matches exported constant", () => {
    const { body } = serializeJson(sampleDraft(), buildFilerProfile({ format: "JSON_API" }), exportableValidation(), baseOpts());
    const envelope = JSON.parse(body);
    expect(envelope.schemaVersion).toBe(ENTRY_SUMMARY_JSON_SCHEMA_VERSION);
  });

  it("2. money fields are strings matching /^\\d+\\.\\d{2}$/", () => {
    const { body } = serializeJson(sampleDraft(), buildFilerProfile({ format: "JSON_API" }), exportableValidation(), baseOpts());
    const envelope = JSON.parse(body);
    expect(envelope.entrySummary.header.B35_TOTAL_ENTERED_VALUE).toMatch(/^\d+\.\d{2}$/);
    expect(envelope.entrySummary.lines[0].fields.B32A_ENTERED_VALUE).toMatch(/^\d+\.\d{2}$/);
    expect(typeof envelope.entrySummary.lines[0].fields.B32A_ENTERED_VALUE).toBe("string");
  });

  it("3. includeProvenance: false -> no provenance key anywhere (deep scan)", () => {
    const profile = buildFilerProfile({ format: "JSON_API", fieldMap: { includeProvenance: false } });
    const { body } = serializeJson(sampleDraft(), profile, exportableValidation(), baseOpts());
    const envelope = JSON.parse(body);
    expect(deepScanForKey(envelope, "provenance")).toBe(false);
  });

  it("4. includeProvenance: true (default) -> every populated block has a non-MISSING provenance entry", () => {
    const profile = buildFilerProfile({ format: "JSON_API", fieldMap: {} });
    const { body } = serializeJson(sampleDraft(), profile, exportableValidation(), baseOpts());
    const envelope = JSON.parse(body);
    expect(envelope.provenance).toBeDefined();
    expect(envelope.provenance.header.B06_PORT_CODE.source).not.toBe("MISSING");
    expect(envelope.provenance.lines[0].B28_DESCRIPTION.source).not.toBe("MISSING");
  });

  it("5. serializing a non-exportable draft throws DraftNotExportable", () => {
    const validation = exportableValidation({ isExportable: false, blockingCount: 2 });
    expect(() => serializeJson(sampleDraft(), buildFilerProfile({ format: "JSON_API" }), validation, baseOpts())).toThrow(
      DraftNotExportable
    );
  });

  it("6. warnings carried through; BLOCKING findings never leak even if hypothetically present", () => {
    const validation = exportableValidation({
      isExportable: true, // hypothetically inconsistent input, defensively filtered anyway
      findings: [
        { code: "W1", severity: "WARNING", blocks: ["B28_DESCRIPTION"], message: "warn", remediation: { label: "x", anchor: "#x" } },
        { code: "B1", severity: "BLOCKING", blocks: ["B28_DESCRIPTION"], message: "should never leak", remediation: { label: "x", anchor: "#x" } },
      ],
    });
    const { body } = serializeJson(sampleDraft(), buildFilerProfile({ format: "JSON_API" }), validation, baseOpts());
    const envelope = JSON.parse(body);
    expect(envelope.validation.warnings).toHaveLength(1);
    expect(envelope.validation.warnings[0].code).toBe("W1");
  });

  it("7. JSON.stringify output byte-identical across 10 runs", () => {
    const draft = sampleDraft();
    const profile = buildFilerProfile({ format: "JSON_API" });
    const validation = exportableValidation();
    const first = serializeJson(draft, profile, validation, baseOpts()).body;
    for (let i = 0; i < 10; i++) {
      expect(serializeJson(draft, profile, validation, baseOpts()).body).toBe(first);
    }
  });

  it("8. structural checks (no JSON-schema dependency added)", () => {
    const { body } = serializeJson(sampleDraft(), buildFilerProfile({ format: "JSON_API" }), exportableValidation(), baseOpts());
    const envelope = JSON.parse(body);
    expect(envelope).toHaveProperty("schemaVersion");
    expect(envelope).toHaveProperty("generatedAt");
    expect(envelope).toHaveProperty("filerCode");
    expect(envelope.source).toEqual({ shipmentId: "shp_1", draftId: "esd_1", draftVersion: 2 });
    expect(Array.isArray(envelope.entrySummary.lines)).toBe(true);
  });
});
