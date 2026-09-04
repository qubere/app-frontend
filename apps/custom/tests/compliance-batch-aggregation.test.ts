import { describe, it, expect } from "vitest";
import { aggregateRecordComplianceStatus, aggregateBatchComplianceStatus } from "@/modules/complianceBatch/aggregation";

// Bulk Compliance Screening: pure aggregation rules. Fail-safe by
// construction -- a technical failure or an unrecognized status can never
// collapse into PASSED, and a record with nothing enabled/executed stays
// NOT_EVALUATED rather than a false PASSED.

describe("aggregateRecordComplianceStatus", () => {
  it("returns NOT_EVALUATED when no service is enabled", () => {
    expect(aggregateRecordComplianceStatus([{ enabled: false, status: null }])).toBe("NOT_EVALUATED");
  });

  it("returns PASSED when every enabled service clears", () => {
    const status = aggregateRecordComplianceStatus([
      { enabled: true, status: "CLEAR" },
      { enabled: true, status: "NO_LICENSE_REQUIRED" },
    ]);
    expect(status).toBe("PASSED");
  });

  it("ignores disabled services when computing PASSED", () => {
    const status = aggregateRecordComplianceStatus([
      { enabled: true, status: "CLEAR" },
      { enabled: false, status: "HIT" },
    ]);
    expect(status).toBe("PASSED");
  });

  it("returns FAILED when any enabled service is HIT", () => {
    const status = aggregateRecordComplianceStatus([
      { enabled: true, status: "CLEAR" },
      { enabled: true, status: "HIT" },
    ]);
    expect(status).toBe("FAILED");
  });

  it("returns FAILED when license determination requires a license", () => {
    const status = aggregateRecordComplianceStatus([{ enabled: true, status: "LICENSE_REQUIRED" }]);
    expect(status).toBe("FAILED");
  });

  it("returns REVIEW_REQUIRED when no FAILED but a REVIEW_REQUIRED is present", () => {
    const status = aggregateRecordComplianceStatus([
      { enabled: true, status: "CLEAR" },
      { enabled: true, status: "REVIEW_REQUIRED" },
    ]);
    expect(status).toBe("REVIEW_REQUIRED");
  });

  it("returns INCOMPLETE when no FAILED/REVIEW_REQUIRED but an INCOMPLETE-class status is present", () => {
    const status = aggregateRecordComplianceStatus([{ enabled: true, status: "RULE_DATA_UNAVAILABLE" }]);
    expect(status).toBe("INCOMPLETE");
  });

  it("fails closed to ERROR on an unrecognized status rather than PASSED", () => {
    const status = aggregateRecordComplianceStatus([{ enabled: true, status: "SOMETHING_UNEXPECTED" }]);
    expect(status).toBe("ERROR");
  });

  it("fails closed to ERROR when an enabled service reports no status", () => {
    const status = aggregateRecordComplianceStatus([{ enabled: true, status: null }]);
    expect(status).toBe("ERROR");
  });
});

describe("aggregateBatchComplianceStatus", () => {
  it("returns NOT_EVALUATED for an empty batch", () => {
    expect(aggregateBatchComplianceStatus([])).toBe("NOT_EVALUATED");
  });

  it("returns NOT_EVALUATED when every record is NOT_EVALUATED", () => {
    expect(aggregateBatchComplianceStatus(["NOT_EVALUATED", "NOT_EVALUATED"])).toBe("NOT_EVALUATED");
  });

  it("returns PASSED when every evaluated record passed", () => {
    expect(aggregateBatchComplianceStatus(["PASSED", "PASSED", "NOT_EVALUATED"])).toBe("PASSED");
  });

  it("returns COMPLETED_WITH_FINDINGS when a record failed", () => {
    expect(aggregateBatchComplianceStatus(["PASSED", "FAILED"])).toBe("COMPLETED_WITH_FINDINGS");
  });

  it("returns COMPLETED_WITH_ERRORS when any record technically errored, even alongside findings", () => {
    expect(aggregateBatchComplianceStatus(["PASSED", "FAILED", "ERROR"])).toBe("COMPLETED_WITH_ERRORS");
  });
});
