/**
 * scripts/reconcile-poa-esign.ts
 *
 * Recovery / reconcile tool for POAs that were signed with the e-sign provider
 * (OpenSign) but never got the completion webhook back — the usual cause on
 * local dev / preview, where sandbox.opensignlabs.com cannot reach the app to
 * POST /api/webhooks/esign/OPEN_SIGN.
 *
 * For every PoaEnvelope that is still "sent"/"out_for_signature" it asks the
 * provider for the real state and, when the provider says the document is
 * signed, runs the exact same completion path the webhook would have run:
 *   - stores an owned copy of the executed PDF
 *   - PoaEnvelope -> completed, PowerOfAttorney -> executed (+ signedDate/expiry)
 *   - promoteSetupForPoa(...) so the portal "Your setup" step advances
 *   - OnboardingEvent POA_EXECUTED + AuditLog
 *
 * Idempotent. Read-only unless the provider reports a completed signature.
 *
 * Run from repo root:
 *   npx tsx apps/custom/scripts/reconcile-poa-esign.ts                # all pending
 *   npx tsx apps/custom/scripts/reconcile-poa-esign.ts --case=<caseId>
 *   npx tsx apps/custom/scripts/reconcile-poa-esign.ts --poa=<poaId>
 *   npx tsx apps/custom/scripts/reconcile-poa-esign.ts --envelope=<providerEnvelopeId>
 *   npx tsx apps/custom/scripts/reconcile-poa-esign.ts --dry-run
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

// App modules are imported dynamically below, AFTER dotenv has populated
// process.env — the OpenSign provider reads OPEN_SIGN_* at module-eval time.
type EsignProviderName = import("@/lib/esign").EsignProviderName;
let db: typeof import("@/lib/db").db;
let runWithAccountId: typeof import("@/lib/db").runWithAccountId;
let createAuditLog: typeof import("@/lib/audit").createAuditLog;
let getEsignProvider: typeof import("@/lib/esign").getEsignProvider;
let promoteSetupForPoa: typeof import("@/lib/portal/clientSetup").promoteSetupForPoa;
let storeDocumentBytes: typeof import("@qubere/storage").storeDocumentBytes;

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}
const DRY_RUN = process.argv.includes("--dry-run");
const caseId = arg("case");
const poaId = arg("poa");
const providerEnvelopeId = arg("envelope");

async function resolveEnvelopeIds(): Promise<string[]> {
  if (caseId) {
    const entities = await db.onboardingEntity.findMany({
      where: { caseId, poaId: { not: null } },
      select: { poaId: true },
    });
    const poaIds = [...new Set(entities.map((e) => e.poaId!).filter(Boolean))];
    const envs = await db.poaEnvelope.findMany({
      where: { powerOfAttorneyId: { in: poaIds } },
      select: { id: true },
    });
    return envs.map((e) => e.id);
  }
  if (poaId) {
    const envs = await db.poaEnvelope.findMany({ where: { powerOfAttorneyId: poaId }, select: { id: true } });
    return envs.map((e) => e.id);
  }
  if (providerEnvelopeId) {
    const envs = await db.poaEnvelope.findMany({ where: { providerEnvelopeId }, select: { id: true } });
    return envs.map((e) => e.id);
  }
  const envs = await db.poaEnvelope.findMany({
    where: { status: { notIn: ["completed", "declined"] }, provider: { in: ["OPEN_SIGN", "DROPBOX_SIGN"] } },
    select: { id: true },
  });
  return envs.map((e) => e.id);
}

async function reconcileOne(envelopeId: string) {
  const envelope = await db.poaEnvelope.findUnique({
    where: { id: envelopeId },
    include: { powerOfAttorney: true },
  });
  if (!envelope) return console.log(`  ! envelope ${envelopeId} not found`);
  const poa = envelope.powerOfAttorney;
  const label = `poa=${poa.id} envelope=${envelope.providerEnvelopeId} provider=${envelope.provider}`;

  if (envelope.status === "completed" || poa.status === "executed") {
    return console.log(`  = already executed — ${label}`);
  }
  if (!envelope.providerEnvelopeId) return console.log(`  ! no providerEnvelopeId — ${label}`);

  const providerName = envelope.provider as EsignProviderName;
  const esign = getEsignProvider(providerName);
  const state = await esign.getEnvelope(envelope.providerEnvelopeId);
  console.log(`  · provider says status=${state.status} — ${label}`);

  if (!["signed", "completed"].includes(state.status)) {
    return console.log(`  … not signed yet, leaving as-is`);
  }
  if (DRY_RUN) return console.log(`  DRY-RUN: would mark executed — ${label}`);

  const completedAt = state.completedAt ?? new Date();

  await runWithAccountId(poa.accountId, async () => {
    let expirationDate = poa.expirationDate;
    if (!expirationDate && poa.templateId) {
      const tpl = await db.poaTemplate.findUnique({ where: { id: poa.templateId } });
      if (tpl?.termMonths) {
        expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + tpl.termMonths);
      }
    }

    const executed = await storeDocumentBytes({
      buffer: await esign.downloadExecutedDocument(envelope.providerEnvelopeId!),
      fileName: `executed-poa-${poa.id}.pdf`,
      contentType: "application/pdf",
      folder: `portal/${poa.accountId}/setup`,
    });

    await db.$transaction([
      db.poaEnvelope.update({
        where: { id: envelope.id },
        data: {
          status: "completed",
          executedDocumentUrl: executed.url,
          completedAt,
          webhookEventsRaw: [
            ...(envelope.webhookEventsRaw as unknown[]),
            { eventType: "completed", raw: { reconciledBy: "reconcile-poa-esign" }, receivedAt: new Date().toISOString() },
          ] as object,
          updatedAt: new Date(),
        },
      }),
      db.powerOfAttorney.update({
        where: { id: poa.id },
        data: {
          status: "executed",
          executedDocumentUrl: executed.url,
          signedDate: completedAt,
          expirationDate: expirationDate ?? null,
          updatedAt: new Date(),
        },
      }),
    ]);

    await promoteSetupForPoa(poa.accountId, poa.id);

    const onboardingEntities = await db.onboardingEntity.findMany({
      where: { accountId: poa.accountId, poaId: poa.id },
      select: { caseId: true },
    });
    for (const entity of onboardingEntities) {
      await db.onboardingEvent.upsert({
        where: { id: `portal-poa-${envelope.id}-${entity.caseId}` },
        update: {},
        create: {
          id: `portal-poa-${envelope.id}-${entity.caseId}`,
          accountId: poa.accountId,
          caseId: entity.caseId,
          type: "POA_EXECUTED",
          actorType: "SYSTEM",
          detail: { poaId: poa.id, provider: providerName, reconciled: true },
        },
      });
    }

    await createAuditLog({
      accountId: poa.accountId,
      userId: null,
      action: "POA_EXECUTED",
      entity: "PowerOfAttorney",
      entityId: poa.id,
      source: "WEBHOOK",
      metadata: { provider: providerName, eventType: "completed", reconciled: true },
    });
  });

  console.log(`  ✓ marked executed — ${label}`);
}

async function main() {
  ({ db, runWithAccountId } = await import("@/lib/db"));
  ({ createAuditLog } = await import("@/lib/audit"));
  ({ getEsignProvider } = await import("@/lib/esign"));
  ({ promoteSetupForPoa } = await import("@/lib/portal/clientSetup"));
  ({ storeDocumentBytes } = await import("@qubere/storage"));

  console.log(`[reconcile-poa-esign] provider=${process.env.ESIGN_PROVIDER ?? "INTERNAL"} dryRun=${DRY_RUN}`);
  const ids = await resolveEnvelopeIds();
  console.log(`[reconcile-poa-esign] ${ids.length} envelope(s) to check`);
  for (const id of ids) await reconcileOne(id);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
