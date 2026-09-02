// Signer role validation per entity type (§7 S7 — signer authority rules).
//
// Pure data + predicates, deliberately kept free of any provider imports so
// client components (e.g. onboarding StepPoa) can use it without pulling the
// e-sign provider barrel — and its Node-only crypto deps — into the browser
// bundle.

export const VALID_SIGNER_ROLES: Record<string, string[]> = {
  US_CORPORATION:       ["OFFICER", "AUTHORIZED_EMPLOYEE"],
  LLC:                  ["MANAGING_MEMBER", "AUTHORIZED_EMPLOYEE"],
  PARTNERSHIP:          ["GENERAL_PARTNER"],
  SOLE_PROPRIETORSHIP:  ["INDIVIDUAL"],
  FOREIGN:              ["OFFICER", "AUTHORIZED_EMPLOYEE", "INDIVIDUAL"],
};

export function validateSignerRole(entityType: string, signerRole: string): boolean {
  const allowed = VALID_SIGNER_ROLES[entityType] ?? ["OFFICER", "AUTHORIZED_EMPLOYEE", "INDIVIDUAL"];
  return allowed.includes(signerRole);
}

export const SIGNER_ROLE_LABELS: Record<string, string> = {
  OFFICER:              "Officer (President, CEO, VP, etc.)",
  AUTHORIZED_EMPLOYEE:  "Authorized employee (by corporate resolution)",
  GENERAL_PARTNER:      "General partner",
  MANAGING_MEMBER:      "Managing member / Manager",
  INDIVIDUAL:           "Individual (sole proprietor or self)",
};
