import { db } from '@/lib/db';
import { syncClientSetup } from '@qubere/db/services/client-setup-service';
export { syncClientSetup };
export async function promoteSetupForPoa(accountId: string, poaId: string) {
    const p = await db.powerOfAttorney.findFirst({ where: { id: poaId, accountId }, select: { importerOfRecord: { select: { clientId: true } } } });
    if (p?.importerOfRecord.clientId)
        await syncClientSetup(accountId, p.importerOfRecord.clientId);
    // Older onboarding importers were created without clientId. The case is
    // still an explicit ownership link; never infer ownership from names/email.
    const cases = await db.onboardingCase.findMany({ where: { accountId, clientId: { not: null }, entities: { some: { accountId, poaId } } }, select: { clientId: true }, distinct: ['clientId'] });
    for (const c of cases)
        if (c.clientId && c.clientId !== p?.importerOfRecord.clientId)
            await syncClientSetup(accountId, c.clientId);
}
export async function promoteSetupForCase(accountId: string, caseId: string) {
    const c = await db.onboardingCase.findFirst({ where: { id: caseId, accountId }, select: { clientId: true } });
    if (c?.clientId)
        await syncClientSetup(accountId, c.clientId);
}
export async function promoteSetupForBond(accountId: string, bondId: string) {
    const clients = await db.importerOfRecord.findMany({ where: { accountId, bondId, clientId: { not: null } }, select: { clientId: true }, distinct: ['clientId'] });
    for (const c of clients)
        if (c.clientId)
            await syncClientSetup(accountId, c.clientId);
    const cases = await db.onboardingCase.findMany({ where: { accountId, clientId: { not: null }, entities: { some: { accountId, bondId } } }, select: { clientId: true }, distinct: ['clientId'] });
    for (const c of cases)
        if (c.clientId && !clients.some(i => i.clientId === c.clientId))
            await syncClientSetup(accountId, c.clientId);
}
