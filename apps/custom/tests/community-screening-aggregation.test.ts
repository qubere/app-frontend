import { describe, it, expect } from "vitest";
import { aggregatePartyStatus, aggregateRunStatus } from "@/modules/compliance/communityScreening/aggregation";

// Community Screening: pure aggregation rules. Precedence: ERROR > FAILED >
// INCOMPLETE > PASSED. Disabled checks are ignored entirely -- never treated
// as a pass or a failure. Fail-closed: any unexpected/null status on an
// enabled check, or zero enabled checks, resolves to ERROR.

describe("aggregatePartyStatus", () => {
  it("returns PASSED when both checks are enabled and CLEAR", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "CLEAR" },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("PASSED");
  });

  it("returns FAILED when restrictedParty is HIT even though embargo is CLEAR", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "HIT" },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("FAILED");
  });

  it("returns FAILED when restrictedParty is REVIEW_REQUIRED", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "REVIEW_REQUIRED" },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("FAILED");
  });

  it("returns FAILED when embargo is HIT even though restrictedParty is CLEAR", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "CLEAR" },
      embargo: { enabled: true, status: "HIT" },
    });
    expect(status).toBe("FAILED");
  });

  it("returns INCOMPLETE when restrictedParty is PARTIAL and embargo is CLEAR (no FAILED present)", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "PARTIAL" },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("INCOMPLETE");
  });

  it("returns INCOMPLETE when embargo is SKIPPED and restrictedParty is CLEAR (no FAILED present)", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "CLEAR" },
      embargo: { enabled: true, status: "SKIPPED" },
    });
    expect(status).toBe("INCOMPLETE");
  });

  it("returns ERROR when an enabled check's status is ERROR", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "ERROR" },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("ERROR");
  });

  it("returns ERROR when an enabled check's status is null", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: null },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("ERROR");
  });

  it("ignores a disabled check entirely, even with a null status -- not ERROR", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: false, status: null },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("PASSED");
  });

  it("ignores a disabled check's HIT status -- not FAILED", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: false, status: "HIT" },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("PASSED");
  });

  it("returns ERROR when both checks are disabled (fail-closed, never a false PASSED)", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: false, status: null },
      embargo: { enabled: false, status: null },
    });
    expect(status).toBe("ERROR");
  });

  it("gives FAILED precedence over INCOMPLETE when both would otherwise apply", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "HIT" },
      embargo: { enabled: true, status: "SKIPPED" },
    });
    expect(status).toBe("FAILED");
  });

  it("gives ERROR precedence over FAILED when both would otherwise apply", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "ERROR" },
      embargo: { enabled: true, status: "HIT" },
    });
    expect(status).toBe("ERROR");
  });

  it("fails closed to ERROR on an unexpected status value not accounted for by any rule", () => {
    const status = aggregatePartyStatus({
      restrictedParty: { enabled: true, status: "SOME_UNKNOWN_STATUS" },
      embargo: { enabled: true, status: "CLEAR" },
    });
    expect(status).toBe("ERROR");
  });
});

describe("aggregateRunStatus", () => {
  it("returns FAILED for an empty array", () => {
    expect(aggregateRunStatus([])).toBe("FAILED");
  });

  it("returns RUNNING when any row is still PENDING", () => {
    expect(aggregateRunStatus(["PASSED", "PENDING"])).toBe("RUNNING");
  });

  it("returns RUNNING when any row is still PROCESSING", () => {
    expect(aggregateRunStatus(["PASSED", "PROCESSING"])).toBe("RUNNING");
  });

  it("returns FAILED when every row is ERROR", () => {
    expect(aggregateRunStatus(["ERROR", "ERROR"])).toBe("FAILED");
  });

  it("returns PARTIAL when some rows are ERROR and some are PASSED/FAILED", () => {
    expect(aggregateRunStatus(["ERROR", "PASSED", "FAILED"])).toBe("PARTIAL");
  });

  it("returns COMPLETED when there is no ERROR and nothing left PENDING/PROCESSING", () => {
    expect(aggregateRunStatus(["PASSED", "FAILED", "INCOMPLETE"])).toBe("COMPLETED");
  });
});
