import { describe, expect, it } from "vitest";
import { reasonsForCategory, validateReasonCode, type ExceptionCategory } from "./resolutionReasons";

// §66: PLAN_CHANGE (reconciliationEngine.ts) and SYSTEM (stageEngine.ts) are
// real ExceptionItem.category values created today, but were absent from this
// module's ExceptionCategory type -- every call site had to `as`-cast around
// it. Widening the type doesn't change which reasons apply (neither category
// has a dedicated reason yet, so both still fall back to the universal set);
// it just makes that fallback an intentional, type-checked outcome instead of
// a silent gap.
const UNIVERSAL_CODES = ["RISK_ACCEPTED_BROKER", "RISK_ACCEPTED_IMPORTER", "FALSE_POSITIVE", "OTHER"];

describe("resolutionReasons: PLAN_CHANGE and SYSTEM categories", () => {
  it.each(["PLAN_CHANGE", "SYSTEM"] satisfies ExceptionCategory[])(
    "%s is a valid ExceptionCategory and resolves to the universal reason set",
    (category) => {
      const reasons = reasonsForCategory(category);
      expect(reasons.map((r) => r.code)).toEqual(UNIVERSAL_CODES);
    }
  );

  it.each(["PLAN_CHANGE", "SYSTEM"] satisfies ExceptionCategory[])(
    "accepts a universal reason code for %s",
    (category) => {
      expect(validateReasonCode("OTHER", category)).toBeNull();
    }
  );

  it.each(["PLAN_CHANGE", "SYSTEM"] satisfies ExceptionCategory[])(
    "rejects a category-specific reason code for %s",
    (category) => {
      expect(validateReasonCode("CLASS_CORRECTED", category)).toMatch(/not valid for exception category/);
    }
  );
});
