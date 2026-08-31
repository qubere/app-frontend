// Readiness computation for OnboardingCase — pure function, no DB access.
// A case is ready_to_activate when all checklist items are "done" or "waived".

export type ChecklistStatus = "done" | "in_progress" | "blocked" | "waived" | "todo";

export interface ChecklistItem {
  item: string;
  label: string;
  status: ChecklistStatus;
  blocker?: string;
  evidenceRef?: string;
}

export interface ReadinessResult {
  ready: boolean;
  checklist: ChecklistItem[];
}

interface CaseShape {
  stepStatus: unknown;
  entities: Array<{
    importerNumber: string | null;
    importerNumberType: string;
    screeningStatus: string;
    bondCoverage: string;
    poa: { status: string } | null;
    bond: {
      status: string;
      verifications?: Array<{ result: string }>;
    } | null;
  }>;
  fiveOhSixRecords: Array<{ status: string }>;
  primaryImporter: { registrationStatus: string } | null;
  projectedAnnualDutyTaxFee: unknown;
}

function stepStatusObj(c: CaseShape): Record<string, unknown> {
  return (c.stepStatus ?? {}) as Record<string, unknown>;
}

function isWaived(c: CaseShape, item: string): boolean {
  const ss = stepStatusObj(c);
  return `waiver_${item}` in ss;
}

export function computeReadiness(c: CaseShape): ReadinessResult {
  const checklist: ChecklistItem[] = [];
  const ss = stepStatusObj(c);

  // 1 — Legal entity complete
  const hasEntity = c.entities.length > 0 && c.entities.every((e) => e.importerNumber || e.importerNumberType === "CBP_ASSIGNED");
  const legalEntityItem: ChecklistItem = {
    item: "legal_entity",
    label: "Legal entity complete",
    status: isWaived(c, "legal_entity") ? "waived" : hasEntity ? "done" : "todo",
  };
  checklist.push(legalEntityItem);

  // 2 — 5106 accepted (or filed-via-portal / waived)
  const fiveOhSixOk =
    c.fiveOhSixRecords.some((r) => r.status === "accepted" || r.status === "submitted") ||
    ss["5106_filed"] === true;
  const fiveOhSixItem: ChecklistItem = {
    item: "five_oh_six",
    label: "CBP Form 5106 submitted",
    status: isWaived(c, "five_oh_six") ? "waived" : fiveOhSixOk ? "done" : "todo",
    blocker: !fiveOhSixOk && !isWaived(c, "five_oh_six") ? "5106 not yet submitted to CBP" : undefined,
  };
  checklist.push(fiveOhSixItem);

  // 3 — POA executed & unexpired
  const poaOk = c.entities.every((e) => e.poa?.status === "executed");
  const poaItem: ChecklistItem = {
    item: "poa",
    label: "Power of Attorney executed",
    status: isWaived(c, "poa") ? "waived" : poaOk ? "done" : c.entities.some((e) => e.poa?.status === "out_for_signature") ? "in_progress" : "todo",
    blocker: !poaOk && !isWaived(c, "poa") ? "POA not yet executed for all entities" : undefined,
  };
  checklist.push(poaItem);

  // 4 — Bond verified & sufficient (or STB / waived)
  const bondOk = c.entities.every((e) => {
    if (e.bondCoverage === "single_transaction") return true;
    if (e.bondCoverage === "broker_bond") return true;
    return e.bond?.status === "verified" || e.bond?.status === "attested";
  });
  const bondItem: ChecklistItem = {
    item: "bond",
    label: "Customs bond verified",
    status: isWaived(c, "bond") ? "waived" : bondOk ? "done" : "todo",
    blocker: !bondOk && !isWaived(c, "bond") ? "Bond not verified for all entities" : undefined,
  };
  checklist.push(bondItem);

  // 5 — Screening cleared
  const screeningOk = c.entities.every(
    (e) => e.screeningStatus === "passed" || e.screeningStatus === "overridden"
  );
  const screeningItem: ChecklistItem = {
    item: "screening",
    label: "Denied-party screening cleared",
    status: isWaived(c, "screening")
      ? "waived"
      : screeningOk
      ? "done"
      : c.entities.some((e) => e.screeningStatus === "blocked")
      ? "blocked"
      : "todo",
    blocker:
      !screeningOk && !isWaived(c, "screening")
        ? c.entities.some((e) => e.screeningStatus === "blocked")
          ? "Screening BLOCKED — requires compliance-role disposition"
          : "Screening not yet run"
        : undefined,
  };
  checklist.push(screeningItem);

  // 6 — Billing configured (step 6 done)
  const billingOk = ss["step_6"] === "done";
  const billingItem: ChecklistItem = {
    item: "billing",
    label: "Billing configured",
    status: isWaived(c, "billing") ? "waived" : billingOk ? "done" : "todo",
  };
  checklist.push(billingItem);

  const ready = checklist.every((i) => i.status === "done" || i.status === "waived");
  return { ready, checklist };
}
