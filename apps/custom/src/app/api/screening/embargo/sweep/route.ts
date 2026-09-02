import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { screenValue } from "@/lib/screening/embargoMatch";

/**
 * Account-wide country-embargo sweep.
 *
 * The per-shipment check (`POST /api/screening/embargo`, surfaced on the shipment
 * workspace) only ever runs one shipment at a time. This endpoint re-runs the
 * same deterministic country match across every non-deleted shipment for the
 * account and persists a `ComplianceScreeningFinding` for each hit, so the
 * Compliance -> Screening -> Embargo sub-tab has a way to trigger a run rather
 * than only reflecting what the pipeline happened to produce.
 *
 * Idempotent: a re-sweep that turns up an embargo that already has an OPEN
 * finding for the same (shipment, rule) reuses that row instead of stacking a
 * duplicate into the unfiltered findings list -- mirrors
 * `persistComplianceScreeningFindings` in modules/compliance/screeningFindings.ts.
 *
 * Private / account-configured embargo rules (`PRIVATE_EMBARGO`) are out of
 * scope here -- those still run in the per-shipment compliance pipeline.
 */

const ruleIdFor = (countryCode: string) => `RULE-COUNTRY-EMBARGO-${countryCode}`;

export const POST = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const accountId = ctx.accountId;

  const rules = await db.embargoRule.findMany();

  // No rules loaded means nothing was checked -- a "0 findings" success here
  // would read as an all-clear it has not earned.
  if (rules.length === 0) {
    return NextResponse.json(
      {
        status: "NOT_SCREENED",
        shipmentsScreened: 0,
        shipmentsWithHits: 0,
        findingsCreated: 0,
        findingsReused: 0,
        message:
          "No embargo rules are loaded, so no shipment was screened against OFAC country sanctions or UFLPA.",
        requestId,
      },
      { status: 503 }
    );
  }

  const shipments = await db.shipment.findMany({
    where: { accountId, deletedAt: null },
    select: { id: true, shipmentNumber: true, countryOfOrigin: true, countryOfExport: true },
  });

  const openKey = (shipmentId: string, ruleId: string) => `${shipmentId}::${ruleId}`;

  // Concurrent sweep requests for the same account (e.g. a double-submitted
  // trigger, or an overlapping scheduled + manual run) each read openFindings
  // before any of them commits its insert -- without serialization every one
  // of them sees "no existing row" and creates its own, producing duplicate
  // OPEN findings for the same (shipmentId, ruleId). Hold a transaction-scoped
  // Postgres advisory lock keyed on accountId so concurrent sweeps for the
  // same account run this read-then-write section one at a time. Lock key
  // namespace 1 is reserved for this account-wide dedup lock -- namespace 0
  // is the per-shipment dedup lock in screeningFindings.ts, and namespace 2
  // is the per-shipment dedup lock in app/api/pga/screen/route.ts; keeping
  // them on separate namespaces means an accountId hash can never collide
  // with a shipmentId hash.
  const { toCreate, shipmentsWithHits, findingsReused } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(1, hashtext(${accountId}))`;

    const openFindings = await tx.complianceScreeningFinding.findMany({
      where: { accountId, category: "COUNTRY_EMBARGO", status: "OPEN" },
      select: { shipmentId: true, ruleId: true },
    });
    const openKeys = new Set(openFindings.map((f) => openKey(f.shipmentId, f.ruleId)));

    let shipmentsWithHits = 0;
    let findingsReused = 0;
    const toCreate: {
      accountId: string;
      shipmentId: string;
      lineNumber: null;
      category: "COUNTRY_EMBARGO";
      ruleId: string;
      ruleName: string;
      severity: "CRITICAL";
      details: string;
    }[] = [];

    for (const shipment of shipments) {
      const matched = new Map<string, { rule: (typeof rules)[number]; signals: Set<string> }>();

      for (const rule of screenValue(shipment.countryOfOrigin, rules)) {
        matched.set(rule.countryCode, { rule, signals: new Set(["country of origin"]) });
      }
      for (const rule of screenValue(shipment.countryOfExport, rules)) {
        const entry = matched.get(rule.countryCode);
        if (entry) entry.signals.add("country of export");
        else matched.set(rule.countryCode, { rule, signals: new Set(["country of export"]) });
      }

      if (matched.size === 0) continue;
      shipmentsWithHits += 1;

      for (const { rule, signals } of matched.values()) {
        const ruleId = ruleIdFor(rule.countryCode);
        if (openKeys.has(openKey(shipment.id, ruleId))) {
          findingsReused += 1;
          continue;
        }
        // Guard against two rules mapping to the same code within one run.
        openKeys.add(openKey(shipment.id, ruleId));

        const originValue = shipment.countryOfOrigin ?? "";
        const exportValue = shipment.countryOfExport ?? "";
        const signalText = [...signals]
          .map((s) => (s === "country of origin" ? `country of origin "${originValue}"` : `country of export "${exportValue}"`))
          .join(" and ");

        toCreate.push({
          accountId,
          shipmentId: shipment.id,
          lineNumber: null,
          category: "COUNTRY_EMBARGO",
          ruleId,
          ruleName: "Country Embargo Screening",
          severity: "CRITICAL",
          details:
            `${signalText} matched ${rule.countryName} (${rule.countryCode}) -- ${rule.regime}: ${rule.restriction}. ` +
            `Authority: ${rule.authority}. Obtain specific OFAC/CBP authorization before entry filing.`,
        });
      }
    }

    if (toCreate.length > 0) {
      await tx.complianceScreeningFinding.createMany({ data: toCreate });
    }

    return { toCreate, shipmentsWithHits, findingsReused };
  });

  await createAuditLog({
    accountId,
    userId: ctx.userId,
    action: "screening.embargo.sweep",
    entity: "Account",
    entityId: accountId,
    source: "UI",
    metadata: {
      shipmentsScreened: shipments.length,
      shipmentsWithHits,
      findingsCreated: toCreate.length,
      findingsReused,
    },
  });

  return NextResponse.json({
    status: "SCREENED",
    shipmentsScreened: shipments.length,
    shipmentsWithHits,
    findingsCreated: toCreate.length,
    findingsReused,
    message:
      `Screened ${shipments.length} shipment(s) against ${rules.length} country embargo rule(s). ` +
      `${toCreate.length} new finding(s), ${findingsReused} already open. ` +
      `Private / account-configured embargo rules are screened per shipment in the compliance pipeline, not in this sweep.`,
    requestId,
  });
}, { permission: "ai.use", write: true });
