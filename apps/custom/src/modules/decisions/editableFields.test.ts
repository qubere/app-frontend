import { describe, it, expect } from "vitest";
import { editableFieldsFor } from "./editableFields";

describe("editableFieldsFor — verification derivation", () => {
  it("marks a missing HTS code as MISSING_REQUIRED", () => {
    const [field] = editableFieldsFor({ agentName: "HTS Classification Agent", proposedHtsCode: null });
    expect(field.status).toBe("MISSING");
    expect(field.verification).toBe("MISSING_REQUIRED");
  });

  it("marks an approved decision's HTS code as AUTO_VERIFIED", () => {
    const [field] = editableFieldsFor({
      agentName: "HTS Classification Agent",
      proposedHtsCode: "8471.30.0100",
      status: "APPROVED",
      triageState: "APPROVED",
    });
    expect(field.status).toBe("PRESENT");
    expect(field.verification).toBe("AUTO_VERIFIED");
  });

  it("marks an auto-verified decision's HTS code as AUTO_VERIFIED", () => {
    const [field] = editableFieldsFor({
      agentName: "HTS Classification Agent",
      proposedHtsCode: "8471.30.0100",
      status: "Auto-Approved",
      triageState: null,
    });
    expect(field.verification).toBe("AUTO_VERIFIED");
  });

  it("marks a present but not-yet-reviewed HTS code as NEEDS_REVIEW", () => {
    const [field] = editableFieldsFor({
      agentName: "HTS Classification Agent",
      proposedHtsCode: "8471.30.0100",
      status: "Needs Review",
      triageState: "NEEDS_REVIEW",
    });
    expect(field.verification).toBe("NEEDS_REVIEW");
  });

  it("marks a rejected decision's HTS code as NEEDS_REVIEW, not AUTO_VERIFIED", () => {
    const [field] = editableFieldsFor({
      agentName: "HTS Classification Agent",
      proposedHtsCode: "8471.30.0100",
      status: "REJECTED",
      triageState: "REJECTED",
    });
    expect(field.verification).toBe("NEEDS_REVIEW");
  });
});
