// Country Embargo Screening -- Private account embargo matcher.
//
// Evaluates the account's PrivateEmbargoRule table (tenant-owned
// country-pair embargo/watch-list policy) for the current check's
// (complianceCountry -> targetCountry) pair. Per doEmbargoCheck.ts's
// dispatch (`if (privateResult.result !== "SKIPPED") return privateResult`),
// this matcher must NEVER return "CLEAR" -- a private non-match means "no
// private hit", not "publicly clear", and must fall through to the next
// matcher in the precedence chain rather than short-circuiting the check.
// Only an actual rule match may short-circuit, and only as a HIT.
import { resolvePrivateEmbargoRule } from "./embargoRepository";
import type { EmbargoCheckContext, EmbargoCheckResult } from "./types";

export async function privateEmbargoMatcher(ctx: EmbargoCheckContext): Promise<EmbargoCheckResult> {
  const rule = await resolvePrivateEmbargoRule(
    ctx.accountId,
    ctx.complianceCountry,
    ctx.targetCountry,
    ctx.screeningDate
  );

  if (!rule) {
    return {
      result: "SKIPPED",
      complianceCountry: ctx.complianceCountry,
      screenedCountry: ctx.targetCountry,
      screeningLevel: ctx.screeningLevel,
      type: ctx.type,
      matcher: "PRIVATE",
      eccn: ctx.eccn,
      militaryEndUse: ctx.militaryEndUse,
      reason: "NO_PRIVATE_RULE_MATCH",
      evidence: {
        note: "No active private embargo rule matched this account/country pair -- continuing to the next applicable matcher.",
      },
      context: ctx,
    };
  }

  return {
    result: "HIT",
    complianceCountry: ctx.complianceCountry,
    screenedCountry: ctx.targetCountry,
    screeningLevel: ctx.screeningLevel,
    type: ctx.type,
    matcher: "PRIVATE",
    eccn: ctx.eccn,
    militaryEndUse: ctx.militaryEndUse,
    ruleId: rule.id,
    reason: `Destination country "${ctx.targetCountry}" matched an active private embargo rule configured for this account (Private / Account-Configured Rule -- not a government sanction).`,
    evidence: {
      scope: "ACCOUNT",
      wildcardFromCountry: rule.appliesToAllFromCountries,
      fromCountry: rule.appliesToAllFromCountries ? null : rule.fromCountryCode,
      toCountry: rule.toCountryCode,
      effectiveDate: rule.effectiveDate,
      expirationDate: rule.expirationDate,
      reason: rule.reason ?? null,
      reference: rule.reference ?? null,
      classification: "PRIVATE_EMBARGO",
    },
    context: ctx,
  };
}
