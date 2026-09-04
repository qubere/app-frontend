// ERP onboarding service — fetch entity/product master from a connected ERP,
// normalise to Qubere types, dedupe against existing records, and produce
// proposals for human review before writing anything.
// Pattern mirrors QuickBooks IntegrationSyncLog / IntegrationEntityMap.

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { getErpProvider } from "@/lib/integrations/erp";
import type { ErpEntity, ErpProduct } from "@/lib/integrations/erp";
import { resolvePartyForCompany } from "@/modules/party/partyResolutionService";
import { recordPendingMatchProposal } from "@/modules/matching/ambiguousMatchService";

export type ProposalAction = "create" | "link_existing" | "skip";

export interface EntityProposal {
  proposalId: string;
  type: "entity";
  action: ProposalAction;
  erp: ErpEntity;
  dedupeCandidates: Array<{
    id: string;
    legalName: string;
    score: number;
    matchReason: string;
  }>;
  linkTargetId?: string;
}

export interface ProductProposal {
  proposalId: string;
  type: "product";
  action: ProposalAction;
  erp: ErpProduct;
  dedupeCandidates: Array<{
    id: string;
    sku?: string;
    name: string;
    score: number;
    matchReason: string;
  }>;
  linkTargetId?: string;
}

export type Proposal = EntityProposal | ProductProposal;

function normaliseName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function bigramSimilarity(a: string, b: string): number {
  const na = normaliseName(a);
  const nb = normaliseName(b);
  if (na === nb) return 1;
  function bigrams(str: string) {
    const s = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2));
    return s;
  }
  const ba = bigrams(na);
  const bb = bigrams(nb);
  let intersection = 0;
  for (const g of ba) { if (bb.has(g)) intersection++; }
  const union = ba.size + bb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function findEntityCandidates(
  accountId: string,
  erp: ErpEntity
): Promise<EntityProposal["dedupeCandidates"]> {
  const candidates: EntityProposal["dedupeCandidates"] = [];

  // Exact EIN match via IOR.cbpImporterNumber
  if (erp.ein) {
    const iors = await db.importerOfRecord.findMany({
      where: { accountId, cbpImporterNumber: erp.ein },
      select: { id: true, name: true },
      take: 3,
    });
    for (const ior of iors) {
      candidates.push({
        id: ior.id,
        legalName: ior.name,
        score: 1,
        matchReason: `Exact EIN/CBP number match (${erp.ein})`,
      });
    }
  }

  if (candidates.length > 0) return candidates;

  // Exact name match
  const exactMatch = await db.importerOfRecord.findFirst({
    where: { accountId, name: { equals: erp.legalName, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (exactMatch) {
    candidates.push({
      id: exactMatch.id,
      legalName: exactMatch.name,
      score: 0.95,
      matchReason: "Exact name match (case-insensitive)",
    });
    return candidates;
  }

  // Fuzzy
  const allIors = await db.importerOfRecord.findMany({
    where: { accountId },
    select: { id: true, name: true },
    take: 500,
  });
  const scored = allIors
    .map((e) => ({
      id: e.id,
      legalName: e.name,
      score: bigramSimilarity(erp.legalName, e.name),
      matchReason: "Fuzzy name match",
    }))
    .filter((c) => c.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  candidates.push(...scored);
  return candidates;
}

async function findProductCandidates(
  accountId: string,
  erp: ErpProduct
): Promise<ProductProposal["dedupeCandidates"]> {
  const candidates: ProductProposal["dedupeCandidates"] = [];

  if (erp.sku) {
    const existing = await db.product.findFirst({
      where: { accountId, internalSku: erp.sku },
      select: { id: true, internalSku: true, productName: true },
    });
    if (existing) {
      candidates.push({
        id: existing.id,
        sku: existing.internalSku ?? undefined,
        name: existing.productName,
        score: 1,
        matchReason: `Exact SKU match (${erp.sku})`,
      });
      return candidates;
    }
  }

  const allProducts = await db.product.findMany({
    where: { accountId },
    select: { id: true, internalSku: true, productName: true },
    take: 500,
  });
  const scored = allProducts
    .map((p) => ({
      id: p.id,
      sku: p.internalSku ?? undefined,
      name: p.productName,
      score: bigramSimilarity(erp.name, p.productName),
      matchReason: "Fuzzy name match",
    }))
    .filter((c) => c.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  candidates.push(...scored);
  return candidates;
}

export async function pullErpData(
  accountId: string,
  integrationConfigId: string
): Promise<{ payloadId: string; proposals: Proposal[] }> {
  const config = await db.integrationConfig.findFirst({
    where: { id: integrationConfigId, accountId, category: "ERP" },
  });
  if (!config) throw Object.assign(new Error("ERP integration not found"), { code: "NOT_FOUND" });

  const provider = getErpProvider(integrationConfigId, config.provider, config.configJson);
  const fetchedAt = new Date().toISOString();

  const [entities, products] = await Promise.all([
    provider.listEntities(),
    provider.listProducts(),
  ]);

  const payload = await db.integrationPayload.create({
    data: {
      accountId,
      integrationConfigId,
      provider: config.provider,
      endpoint: "erp/pull",
      payloadJson: { entities, products, fetchedAt } as unknown as Prisma.InputJsonValue,
      recordCount: entities.length + products.length,
    },
  });

  const proposals: Proposal[] = [];

  for (let i = 0; i < entities.length; i++) {
    const erp = entities[i];
    const dedupeCandidates = await findEntityCandidates(accountId, erp);

    // Call resolvePartyForCompany for party master resolution
    try {
      const resolved = await resolvePartyForCompany(
        { accountId, userId: null, requestId: null },
        { legalName: erp.legalName, country: erp.countryOfFormation || "US", taxId: erp.ein ?? null }
      );
      if (resolved.outcome === "CANDIDATES") {
        await recordPendingMatchProposal({
          accountId,
          domain: "PARTY",
          matchStatus: resolved.status,
          targetEntityType: "ERP_IMPORT",
          source: "ERP",
          inputPayload: { legalName: erp.legalName, country: erp.countryOfFormation || "US", taxId: erp.ein ?? null },
          candidatesJson: resolved.candidates as any,
        });
      }
    } catch {
      // Fail-open for ERP import loop
    }

    proposals.push({
      proposalId: `entity-${i}`,
      type: "entity",
      action: dedupeCandidates.some((c) => c.score === 1) ? "link_existing" : "create",
      erp,
      dedupeCandidates,
      linkTargetId: dedupeCandidates.find((c) => c.score === 1)?.id,
    });
  }

  for (let i = 0; i < products.length; i++) {
    const erp = products[i];
    const dedupeCandidates = await findProductCandidates(accountId, erp);
    proposals.push({
      proposalId: `product-${i}`,
      type: "product",
      action: dedupeCandidates.some((c) => c.score === 1) ? "link_existing" : "create",
      erp,
      dedupeCandidates,
      linkTargetId: dedupeCandidates.find((c) => c.score === 1)?.id,
    });
  }

  await db.integrationPayload.update({
    where: { id: payload.id },
    data: { payloadJson: { entities, products, fetchedAt, proposals } as unknown as Prisma.InputJsonValue },
  });

  return { payloadId: payload.id, proposals };
}

export async function getErpProposals(
  accountId: string,
  integrationConfigId: string
): Promise<{ payloadId: string | null; proposals: Proposal[] }> {
  const payload = await db.integrationPayload.findFirst({
    where: { accountId, integrationConfigId },
    orderBy: { fetchedAt: "desc" },
  });
  if (!payload) return { payloadId: null, proposals: [] };
  const data = payload.payloadJson as { proposals?: Proposal[] };
  return { payloadId: payload.id, proposals: data.proposals ?? [] };
}

export interface CommitItem {
  proposalId: string;
  action: ProposalAction;
  linkTargetId?: string;
}

export interface CommitErpResult {
  created: number;
  linked: number;
  skipped: number;
}

export async function commitErpProposals(
  accountId: string,
  userId: string | null,
  integrationConfigId: string,
  items: CommitItem[]
): Promise<CommitErpResult> {
  const config = await db.integrationConfig.findFirst({
    where: { id: integrationConfigId, accountId, category: "ERP" },
  });
  if (!config) throw Object.assign(new Error("ERP integration not found"), { code: "NOT_FOUND" });

  const payload = await db.integrationPayload.findFirst({
    where: { accountId, integrationConfigId },
    orderBy: { fetchedAt: "desc" },
  });
  if (!payload) throw Object.assign(new Error("No proposals found — run pull first"), { code: "NOT_FOUND" });

  const data = payload.payloadJson as { proposals?: Proposal[] };
  const proposalMap = new Map<string, Proposal>(
    (data.proposals ?? []).map((p) => [p.proposalId, p])
  );

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const item of items) {
    const proposal = proposalMap.get(item.proposalId);
    if (!proposal) continue;
    if (item.action === "skip") { skipped++; continue; }

    if (proposal.type === "entity") {
      const erp = (proposal as EntityProposal).erp;

      if (item.action === "link_existing" && item.linkTargetId) {
        // Upsert by the real unique key: provider + realmId + qubereType + qubereId
        await db.integrationEntityMap.upsert({
          where: {
            provider_realmId_qubereType_qubereId: {
              provider: config.provider,
              realmId: integrationConfigId,
              qubereType: "ImporterOfRecord",
              qubereId: item.linkTargetId,
            },
          },
          update: { lastSyncedAt: new Date() },
          create: {
            accountId,
            integrationConfigId,
            provider: config.provider,
            realmId: integrationConfigId,
            qubereType: "ImporterOfRecord",
            qubereId: item.linkTargetId,
            providerType: "Entity",
            providerId: erp.providerId,
          },
        });
        linked++;
      } else if (item.action === "create") {
        const ior = await db.importerOfRecord.create({
          data: {
            accountId,
            name: erp.legalName,
            irsEin: erp.ein ?? "",
            cbpImporterNumber: erp.ein ?? null,
            registrationStatus: "unregistered",
            address: (erp.physicalAddress ?? { line1: "", city: "", country: erp.countryOfFormation ?? "US" }) as Prisma.InputJsonValue,
          },
        });

        await db.integrationEntityMap.create({
          data: {
            accountId,
            integrationConfigId,
            provider: config.provider,
            realmId: integrationConfigId,
            qubereType: "ImporterOfRecord",
            qubereId: ior.id,
            providerType: "Entity",
            providerId: erp.providerId,
          },
        });

        const onboardingCase = await db.onboardingCase.create({
          data: {
            accountId,
            path: "ERP",
            status: "draft",
            currentStep: 1,
            stepStatus: {},
            blockers: [],
            source: "ERP",
            primaryImporterId: ior.id,
          },
        });

        await db.onboardingEntity.create({
          data: {
            accountId,
            caseId: onboardingCase.id,
            importerOfRecordId: ior.id,
            importerNumberType: erp.ein ? "EIN" : "CBP_ASSIGNED",
            importerNumber: erp.ein ?? null,
            officers: [],
          },
        });

        created++;
      }
    } else if (proposal.type === "product") {
      const erp = (proposal as ProductProposal).erp;

      if (item.action === "link_existing" && item.linkTargetId) {
        await db.integrationEntityMap.upsert({
          where: {
            provider_realmId_qubereType_qubereId: {
              provider: config.provider,
              realmId: integrationConfigId,
              qubereType: "Product",
              qubereId: item.linkTargetId,
            },
          },
          update: { lastSyncedAt: new Date() },
          create: {
            accountId,
            integrationConfigId,
            provider: config.provider,
            realmId: integrationConfigId,
            qubereType: "Product",
            qubereId: item.linkTargetId,
            providerType: "Product",
            providerId: erp.providerId,
          },
        });
        linked++;
      } else if (item.action === "create") {
        const product = await db.product.create({
          data: {
            accountId,
            productName: erp.name,
            internalSku: erp.sku ?? null,
            commercialDescription: erp.description ?? null,
          },
        });

        await db.integrationEntityMap.create({
          data: {
            accountId,
            integrationConfigId,
            provider: config.provider,
            realmId: integrationConfigId,
            qubereType: "Product",
            qubereId: product.id,
            providerType: "Product",
            providerId: erp.providerId,
          },
        });
        created++;
      }
    }
  }

  await db.integrationSyncLog.create({
    data: {
      accountId,
      integrationConfigId,
      provider: config.provider,
      direction: "INBOUND",
      entityType: "ERP_ONBOARDING",
      status: "SUCCESS",
      message: `Committed ${created} created, ${linked} linked, ${skipped} skipped`,
      requestJson: { itemCount: items.length },
      responseJson: { created, linked, skipped },
    },
  });

  await createAuditLog({
    accountId,
    userId,
    action: "ONBOARDING_CASE_CREATED",
    entity: "IntegrationEntityMap",
    entityId: integrationConfigId,
    source: "ERP_IMPORT",
    metadata: { created, linked, skipped },
  });

  return { created, linked, skipped };
}
