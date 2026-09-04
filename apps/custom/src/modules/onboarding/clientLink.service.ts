import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { syncClientSetup } from '@qubere/db/services/client-setup-service';

const conflict = (message: string) => Object.assign(new Error(message), { code: 'CONFLICT' });

/** Explicit broker correction, never a name/email match or a client merge. */
export async function linkOnboardingClient(accountId: string, caseId: string, clientId: string, userId: string) {
  return db.$transaction(async tx => {
    const c = await tx.onboardingCase.findFirst({
      where: { id: caseId, accountId },
      include: { entities: true, fiveOhSixRecords: { select: { id: true } } },
    });
    const client = await tx.client.findFirst({ where: { id: clientId, accountId }, select: { id: true, name: true } });
    if (!c || !client) throw Object.assign(new Error('Case or client not found'), { code: 'NOT_FOUND' });
    const changingClient = c.clientId !== clientId;
    if (changingClient && (c.activatedAt || ['active', 'activated', 'withdrawn'].includes(c.status))) {
      throw conflict('An activated or withdrawn case cannot be moved to another client.');
    }
    const importerIds = [...new Set([c.primaryImporterId, ...c.entities.map(e => e.importerOfRecordId)].filter((id): id is string => !!id))];
    const importers = await tx.importerOfRecord.findMany({
      where: { id: { in: importerIds }, accountId },
      select: { id: true, clientId: true, powersOfAttorney: { select: { id: true } }, _count: { select: { shipments: true, customsFilings: true, invoices: true, customsCases: true } }, onboardingEntities: { where: { caseId: { not: caseId } }, select: { id: true }, take: 1 } },
    });
    if (importers.length !== importerIds.length) throw conflict('A case importer is unavailable in this account.');
    for (const importer of importers) {
      if (importer.clientId && importer.clientId !== c.clientId && importer.clientId !== clientId) {
        throw conflict('A case importer belongs to another client. Review its ownership first.');
      }
      if (importer.clientId !== clientId && (Object.values(importer._count).some(n => n > 0) || importer.onboardingEntities.length)) {
        throw conflict('An importer is already used by other cases or operations. Review its client assignment before moving this setup.');
      }
    }
    // A case correction must not silently migrate an established customer's
    // access, requests or operational history along with a duplicate client.
    if (changingClient && c.clientId) {
      const sourceInUse = await tx.client.findFirst({
        where: { id: c.clientId, accountId, OR: [
          { userAssignments: { some: {} } }, { invitations: { some: { status: { in: ['PENDING', 'ACCEPTED'] } } } },
          { shipments: { some: {} } }, { invoices: { some: {} } }, { customerRequests: { some: {} } },
          { onboardingCases: { some: { id: { not: caseId } } } },
          { onboardingCases: { some: { id: { not: caseId } } } },
        ] }, select: { id: true },
      });
      if (sourceInUse) throw conflict('The current client has portal access or operational records. This correction is for unused duplicate clients; review the client assignments first.');
    }
    const legalEntityIds = c.entities.flatMap(e => e.legalEntityId ? [e.legalEntityId] : []);
    const conflictingEntity = await tx.legalEntity.findFirst({ where: { id: { in: legalEntityIds }, OR: [{ accountId: { not: accountId } }, { clientId: { not: null, notIn: [clientId, ...(c.clientId ? [c.clientId] : [])] } }] }, select: { id: true } });
    if (conflictingEntity) throw conflict('A legal entity belongs to another client. Review its ownership first.');

    if (changingClient && c.clientId) {
      const sourceRefs = [
        { sourceModel: 'PowerOfAttorney', sourceId: { in: [...c.entities.flatMap(e => e.poaId ? [e.poaId] : []), ...importers.flatMap(i => i.powersOfAttorney.map(p => p.id))] } },
        { sourceModel: 'Bond', sourceId: { in: c.entities.flatMap(e => e.bondId ? [e.bondId] : []) } },
        { sourceModel: 'FiveOhSixRecord', sourceId: { in: c.fiveOhSixRecords.map(r => r.id) } },
      ];
      // Move only already-published case documents, including their visibility
      // and revoked state. Unrelated client files and access remain unchanged.
      await tx.clientDocument.updateMany({ where: { accountId, clientId: c.clientId, OR: sourceRefs }, data: { clientId } });
    }
    await tx.importerOfRecord.updateMany({ where: { id: { in: importerIds }, accountId }, data: { clientId } });
    await tx.legalEntity.updateMany({ where: { id: { in: legalEntityIds }, accountId }, data: { clientId } });
    const stepStatus = c.stepStatus as Record<string, Prisma.JsonValue>;
    const nextStepStatus = { ...stepStatus };
    if (changingClient) {
      // Billing/access was configured for the old client; review it for the
      // selected client rather than treating the old confirmation as valid.
      delete nextStepStatus.step_6;
      delete nextStepStatus.waiver_billing;
    }
    await tx.onboardingCase.update({ where: { id: caseId, accountId }, data: { clientId, ...(changingClient ? { stepStatus: nextStepStatus as Prisma.InputJsonObject } : {}) } });
    await syncClientSetup(accountId, clientId, tx);
    await tx.onboardingEvent.create({ data: { accountId, caseId, type: 'CLIENT_LINKED', actorUserId: userId, actorType: 'USER', detail: { previousClientId: c.clientId, clientId } } });
    return { client };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
}
