import { storeDocumentBytes } from "@qubere/storage";
import { promoteSetupForPoa } from "@/lib/portal/clientSetup";
// Authenticate provider callbacks before database writes. OpenSign supports its
// configured query secret and the legacy header configuration. Completed bytes
// are confirmed through the provider API, stored and promoted to customer setup.


import { NextResponse } from "next/server";
import { db, runWithAccountId } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { getEsignProvider } from "@/lib/esign";
import type { EsignProviderName } from "@/lib/esign";

export const POST = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider } = await params;
  const providerName = (provider?.toUpperCase() ?? "") as EsignProviderName;
  if (!["DROPBOX_SIGN", "OPEN_SIGN"].includes(providerName)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  let rawBody: Buffer;
  try {
    rawBody = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Failed to read body" }, { status: 400 });
  }

  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  // Dropbox Sign requires a plain 200 "Hello API Event Received" response.
  const dropboxHandshake = providerName === "DROPBOX_SIGN";

  let event;
  try {
    const provider = getEsignProvider(providerName);
    event = provider.parseWebhook(headers, rawBody, req.url);
  } catch {
    // Return 200 to Dropbox Sign even on bad signature so they don't disable the endpoint.
    if (dropboxHandshake) return new NextResponse("Hello API Event Received", { status: 200 });
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  const envelope = await db.poaEnvelope.findFirst({
    where: { providerEnvelopeId: event.providerEnvelopeId, provider: providerName },
    include: { powerOfAttorney: true },
  });

  if (!envelope) {
    if (dropboxHandshake) return new NextResponse("Hello API Event Received", { status: 200 });
    return NextResponse.json({ ignored: true });
  }

  const completedAt = event.completedAt ?? new Date();

  await runWithAccountId(envelope.powerOfAttorney.accountId, async () => {
    if (event.eventType === "completed") {
      const poa = envelope.powerOfAttorney;
      if (['revoked', 'expired'].includes(poa.status) || envelope.status === 'completed') {
        await promoteSetupForPoa(poa.accountId, poa.id);
        return;
      }
      let expirationDate = poa.expirationDate;
      if (!expirationDate && poa.templateId) {
        const tpl = await db.poaTemplate.findUnique({ where: { id: poa.templateId } });
        if (tpl?.termMonths) {
          expirationDate = new Date();
          expirationDate.setMonth(expirationDate.getMonth() + tpl.termMonths);
        }
      }

      // Fetch signed bytes through the authenticated provider, then keep an owned copy.
      const esign = getEsignProvider(providerName);
      const state = await esign.getEnvelope(envelope.providerEnvelopeId!);
      if (!["signed", "completed"].includes(state.status)) throw new Error("Provider has not completed this signature");
      const executed = await storeDocumentBytes({buffer:await esign.downloadExecutedDocument(envelope.providerEnvelopeId!),fileName:`executed-poa-${poa.id}.pdf`,contentType:"application/pdf",folder:`portal/${poa.accountId}/setup`});
      await db.$transaction([
        db.poaEnvelope.update({
          where: { id: envelope.id },
          data: {
            status: "completed",
            executedDocumentUrl: executed.url,
            completedAt,
            webhookEventsRaw: [
              ...(envelope.webhookEventsRaw as unknown[]),
              { eventType: "completed", raw: event.rawPayload, receivedAt: new Date().toISOString() },
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
      const onboardingEntities = await db.onboardingEntity.findMany({ where: { accountId: poa.accountId, poaId: poa.id }, select: { caseId: true } });
      for (const entity of onboardingEntities) {
        await db.onboardingEvent.upsert({ where: { id: `portal-poa-${envelope.id}-${entity.caseId}` }, update: {}, create: { id: `portal-poa-${envelope.id}-${entity.caseId}`, accountId: poa.accountId, caseId: entity.caseId, type: 'POA_EXECUTED', actorType: 'SYSTEM', detail: { poaId: poa.id, provider: providerName } } });
      }

      await createAuditLog({
        accountId: poa.accountId,
        userId: null,
        action: "POA_EXECUTED",
        entity: "PowerOfAttorney",
        entityId: poa.id,
        source: "WEBHOOK",
        metadata: { provider: providerName, eventType: "completed" },
      });
    } else if (event.eventType === "declined") {
      await db.$transaction([
        db.poaEnvelope.update({
          where: { id: envelope.id },
          data: {
            status: "declined",
            webhookEventsRaw: [
              ...(envelope.webhookEventsRaw as unknown[]),
              { eventType: "declined", raw: event.rawPayload, receivedAt: new Date().toISOString() },
            ] as object,
            updatedAt: new Date(),
          },
        }),
        db.powerOfAttorney.update({
          where: { id: envelope.powerOfAttorneyId },
          data: { status: "declined", updatedAt: new Date() },
        }),
      ]);
    } else {
      // sent / signed / other — update envelope status only
      await db.poaEnvelope.update({
        where: { id: envelope.id },
        data: {
          status: event.eventType,
          webhookEventsRaw: [
            ...(envelope.webhookEventsRaw as unknown[]),
            { eventType: event.eventType, receivedAt: new Date().toISOString() },
          ] as object,
          updatedAt: new Date(),
        },
      });
    }
  });

  if (dropboxHandshake) return new NextResponse("Hello API Event Received", { status: 200 });
  return NextResponse.json({ ok: true });
};
