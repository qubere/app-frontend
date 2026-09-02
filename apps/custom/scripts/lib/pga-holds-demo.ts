import type { Prisma, PrismaClient } from "@prisma/client";
import { assertDemoSeedingAllowed } from "../../src/lib/environment";

export const PGA_DEMO_PREFIX = "qubere-pga-demo-v1";
const HOUR = 3_600_000;
const DISCLAIMER = "DEMO ONLY — synthetic training evidence; no agency notice was received and nothing was transmitted.";

export type PgaDemoOptions = {
  accountId: string;
  shipmentId: string;
  userId?: string;
  dryRun?: boolean;
};

const scenarios = [
  { key: "fda-open", agency: "FDA", status: "Open", hours: 6,
    reason: "Prepare the lot / batch details for this simulated FDA hold." },
  { key: "usda-rejected", agency: "USDA", status: "Rejected", hours: 48,
    reason: "Correct the species scientific name in this simulated rejected response." },
  { key: "epa-submitted", agency: "EPA", status: "Submitted", hours: 24,
    reason: "A simulated manual response is recorded; agency acceptance is not confirmed." },
  { key: "cpsc-released", agency: "CPSC", status: "Released", hours: 72,
    reason: "Simulated release retained for the shipment's hold history." },
] as const;

/** Explicitly scoped administrative seed; never imports the cached application client. */
export async function seedPgaHolds(db: PrismaClient, options: PgaDemoOptions, now = new Date()) {
  assertDemoSeedingAllowed();
  if (!options.accountId?.trim() || !options.shipmentId?.trim()) {
    throw new Error("Both --account-id and --shipment-id are required.");
  }
  if (!db.pgaHold || !db.pgaHoldSubmission) {
    throw new Error("Prisma client is missing PGA models. Run npm --workspace @qubere/db run db:generate, then restart the app.");
  }

  // A single transaction prevents partial histories/audits. Serialization or unique-key
  // conflicts fail visibly; a rerun safely skips any already-committed seed records.
  return db.$transaction(async (tx) => {
    const account = await tx.account.findFirst({
      where: { id: options.accountId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, dataMode: true },
    });
    if (!account) throw new Error("Active account not found for --account-id.");
    if (account.dataMode !== "DEMO" && account.dataMode !== "SANDBOX") {
      throw new Error("PGA demo holds can only be seeded in a DEMO or SANDBOX account.");
    }
    const shipment = await tx.shipment.findFirst({
      where: { id: options.shipmentId, accountId: account.id, deletedAt: null },
      select: { id: true, shipmentNumber: true, importerName: true },
    });
    if (!shipment) throw new Error("Shipment not found in the selected account, or it has been deleted.");
    const member = await tx.accountMembership.findFirst({
      where: { accountId: account.id, status: "ACTIVE", deletedAt: null,
        ...(options.userId ? { userId: options.userId } : {}) },
      select: { userId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    if (!member) throw new Error("An active account member is required; check --user-id if supplied.");

    const rows: { agency: string; status: string; action: string; holdId: string | null }[] = [];
    for (const scenario of scenarios) {
      const externalKey = `${PGA_DEMO_PREFIX}:${shipment.id}:${scenario.key}`;
      const existing = await tx.pgaHold.findUnique({
        where: { accountId_externalKey: { accountId: account.id, externalKey } },
        select: { id: true, shipmentId: true, status: true },
      });
      if (existing) {
        if (existing.shipmentId !== shipment.id) throw new Error("Seed reference belongs to a different shipment.");
        rows.push({ agency: scenario.agency, status: existing.status, action: "kept", holdId: existing.id });
        continue;
      }
      if (options.dryRun) {
        rows.push({ agency: scenario.agency, status: scenario.status, action: "would create", holdId: null });
        continue;
      }

      const issuedAt = new Date(now.getTime() - scenario.hours * HOUR);
      const submittedAt = new Date(issuedAt.getTime() + HOUR);
      const responseAt = new Date(issuedAt.getTime() + 2 * HOUR);
      const hasSubmission = scenario.status !== "Open";
      const hasResponse = scenario.status === "Rejected" || scenario.status === "Released";
      const form: Record<string, string> = {
        importer: shipment.importerName,
        description: "DEMO — synthetic commodity for agency-hold workflow training",
        ...(scenario.agency === "FDA" ? { lotNumber: "DEMO-LOT-001" } : {}),
        ...(scenario.agency === "USDA" ? { scientificName: "DEMO — species name needs correction" } : {}),
      };
      const submission: Prisma.PgaHoldSubmissionUncheckedCreateWithoutPgaHoldInput = {
        accountId: account.id,
        idempotencyKey: `${account.id}:${externalKey}`,
        requestKey: externalKey,
        attemptNumber: 1,
        messageSetText: `${DISCLAIMER}\nSimulated ${scenario.agency} manual filing for ${shipment.shipmentNumber}.`,
        formInputJson: form,
        status: scenario.status === "Rejected" ? "Rejected" : scenario.status === "Released" ? "Accepted" : "Sent",
        transmissionMode: "MANUAL",
        externalReference: `DEMO-${scenario.key.toUpperCase()}`,
        // A real member supplies the demo UI's operator reference. The audit is
        // attributed to the seed, never to a claimed action by this member.
        operatorUserId: member.userId,
        submittedAt,
        ...(hasResponse ? { responseAt, rawResponse: `${DISCLAIMER}\nSimulated outcome: ${scenario.status}. ${scenario.reason}` } : {}),
        ...(scenario.status === "Rejected" ? {
          rejectionCode: "DEMO-FIELD-CORRECTION",
          rejectionReason: `[DEMO] ${scenario.reason}`,
          rejectedFields: ["scientificName"],
        } : {}),
      };
      const hold = await tx.pgaHold.create({
        data: {
          accountId: account.id, shipmentId: shipment.id, externalKey,
          agencyCode: scenario.agency, holdCode: `DEMO-${scenario.agency}-HOLD`,
          reasonText: `[DEMO] ${scenario.reason}`,
          rawNotice: `${DISCLAIMER}\n${scenario.reason}\nThis scenario does not assert agency applicability to the shipment's goods.`,
          status: scenario.status, issuedAt,
          closedAt: scenario.status === "Released" ? responseAt : null,
          version: hasResponse ? 2 : hasSubmission ? 1 : 0,
          ...(scenario.status === "Open" || scenario.status === "Rejected" ? {
            draftFormInput: form, draftUpdatedAt: now,
          } : {}),
          ...(hasSubmission ? { submissions: { create: submission } } : {}),
        },
        select: { id: true },
      });
      await tx.auditLog.create({ data: {
        accountId: account.id, action: "PGA_HOLD_DEMO_SEEDED", entity: "Shipment",
        entityId: shipment.id, source: "SCRIPT", reason: DISCLAIMER,
        metadata: { origin: "PGA_DEMO_SEED", holdId: hold.id, scenario: scenario.key,
          simulatedOperatorUserId: member.userId, synthetic: true, transmitted: false },
      } });
      rows.push({ agency: scenario.agency, status: scenario.status, action: "created", holdId: hold.id });
    }
    return { account, shipment, rows };
  }, { isolationLevel: "Serializable", maxWait: 10_000, timeout: 30_000 });
}
