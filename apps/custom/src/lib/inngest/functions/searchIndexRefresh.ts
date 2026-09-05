import { createHash } from "node:crypto";
import { inngest } from "../client";
import { db, runWithAccountId } from "@/lib/db";
import { documentViewUrl } from "@/lib/documentUrl";
import { partyDisplayName } from "@/modules/party/partyDisplay";
import { HybridMemoryRetriever } from "@/modules/memory/memory.retriever";
import { SearchIndexRepository, SEARCH_INDEX_KINDS, type SearchIndexKind } from "@/modules/search/searchIndexRepository";

export const SEARCH_INDEX_DATASET_ID = "search-index";
const DATASET_NAME = "Cross-entity search index (omnibox semantic layer)";

/**
 * Rows any single kind will (re)embed in one run. Bounds the Gemini call
 * volume per run rather than trying to catch a whole backlog (e.g. the full
 * HtsNode table) in one pass -- an unindexed backlog shrinks by this many
 * rows per night until caught up, rather than the job running for hours or
 * blowing an embedding-cost budget on its first execution.
 */
const MAX_EMBED_PER_KIND_PER_RUN = 500;

interface IndexCandidate {
  accountId: string | null;
  entityId: string;
  title: string;
  subtitle?: string | null;
  href: string;
  searchText: string;
}

function contentHash(searchText: string): string {
  return createHash("sha256").update(searchText).digest("hex");
}

function joinText(...parts: Array<string | null | undefined>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(" · ");
}

async function fetchCandidates(kind: SearchIndexKind): Promise<IndexCandidate[]> {
  switch (kind) {
    case "shipment": {
      const rows = await db.shipment.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          accountId: true,
          shipmentNumber: true,
          importerName: true,
          poReference: true,
          portOfEntry: true,
          carrierName: true,
          status: true,
          client: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10000,
      });
      return rows.map((r) => ({
        accountId: r.accountId,
        entityId: r.id,
        title: r.shipmentNumber,
        subtitle: joinText(r.client?.name, r.status),
        href: `/app/shipments/${r.id}`,
        searchText: joinText(r.shipmentNumber, r.importerName, r.poReference, r.portOfEntry, r.carrierName, r.client?.name, r.status),
      }));
    }
    case "document": {
      const rows = await db.shipmentDocument.findMany({
        select: {
          id: true,
          accountId: true,
          fileName: true,
          docType: true,
          status: true,
          parsedSearchText: true,
          shipment: { select: { shipmentNumber: true } },
          client: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10000,
      });
      return rows.map((r) => ({
        accountId: r.accountId,
        entityId: r.id,
        title: r.fileName,
        subtitle: joinText(r.docType, r.shipment?.shipmentNumber),
        href: documentViewUrl(r.id),
        // parsedSearchText already carries the parsed-field summary; capped so a
        // single verbose document doesn't dominate the embedding call cost.
        searchText: joinText(r.fileName, r.docType, r.status, r.shipment?.shipmentNumber, r.client?.name, r.parsedSearchText?.slice(0, 4000)),
      }));
    }
    case "person": {
      const rows = await db.accountMembership.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        select: {
          accountId: true,
          userId: true,
          user: { select: { firstName: true, lastName: true, email: true, brokerLicenseNumber: true } },
        },
        take: 5000,
      });
      return rows.map((r) => ({
        accountId: r.accountId,
        entityId: r.userId,
        title: joinText(r.user.firstName, r.user.lastName) || r.user.email,
        subtitle: r.user.email,
        href: `/app/admin/users`,
        searchText: joinText(r.user.firstName, r.user.lastName, r.user.email, r.user.brokerLicenseNumber),
      }));
    }
    case "product": {
      const rows = await db.product.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          accountId: true,
          productName: true,
          internalSku: true,
          brand: true,
          model: true,
          commercialDescription: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 10000,
      });
      return rows.map((r) => ({
        accountId: r.accountId,
        entityId: r.id,
        title: r.productName,
        subtitle: r.internalSku ? `SKU: ${r.internalSku}` : null,
        href: `/app/products/${r.id}?tab=evidence`,
        searchText: joinText(r.productName, r.internalSku, r.brand, r.model, r.commercialDescription),
      }));
    }
    case "importer": {
      const rows = await db.importerOfRecord.findMany({
        select: { id: true, accountId: true, name: true, irsEin: true, cbpImporterNumber: true, registrationStatus: true },
        take: 5000,
      });
      return rows.map((r) => ({
        accountId: r.accountId,
        entityId: r.id,
        title: r.name,
        subtitle: r.cbpImporterNumber ? `CBP #: ${r.cbpImporterNumber}` : r.registrationStatus,
        href: `/app/importers-of-record`,
        searchText: joinText(r.name, r.irsEin, r.cbpImporterNumber, r.registrationStatus),
      }));
    }
    case "party": {
      const rows = await db.party.findMany({
        where: { deletedAt: null },
        include: { names: { where: { status: "ACTIVE" }, take: 3 } },
        orderBy: { updatedAt: "desc" },
        take: 10000,
      });
      return rows.map((r) => ({
        accountId: r.accountId,
        entityId: r.id,
        title: partyDisplayName(r),
        subtitle: r.internalPartyCode ? `Code: ${r.internalPartyCode}` : null,
        href: `/app/parties/${r.id}?tab=evidence`,
        searchText: joinText(...r.names.map((n) => n.rawName), r.internalPartyCode),
      }));
    }
    case "client": {
      const rows = await db.client.findMany({
        select: { id: true, accountId: true, name: true, contactName: true, contactEmail: true, status: true },
        take: 5000,
      });
      return rows.map((r) => ({
        accountId: r.accountId,
        entityId: r.id,
        title: r.name,
        subtitle: r.status,
        href: `/app/clients/${r.id}`,
        searchText: joinText(r.name, r.contactName, r.contactEmail),
      }));
    }
    case "ruling": {
      const rows = await db.ruling.findMany({
        select: { id: true, rulingNumber: true, title: true, office: true, htsReferences: { select: { htsNumberDisplay: true }, take: 1 } },
        orderBy: { issuedAt: "desc" },
        take: 5000,
      });
      return rows.map((r) => ({
        accountId: null,
        entityId: r.id,
        title: `${r.rulingNumber} — ${r.title}`,
        subtitle: r.office,
        href: r.htsReferences[0]?.htsNumberDisplay ? `/app/hts?code=${r.htsReferences[0].htsNumberDisplay}` : "/app/regulatory",
        searchText: joinText(r.rulingNumber, r.title, r.office),
      }));
    }
    case "hts_node": {
      const rows = await db.htsNode.findMany({
        where: { isClassifiable: true, codeLevel: { gte: 8 } },
        select: { id: true, htsNumberDisplay: true, htsNumberNormalized: true, description: true, chapter: true, heading: true },
        take: 10000,
      });
      return rows.map((r) => ({
        accountId: null,
        entityId: r.id,
        title: r.htsNumberDisplay,
        subtitle: r.description,
        href: `/app/hts?code=${r.htsNumberDisplay}`,
        searchText: joinText(r.htsNumberDisplay, r.htsNumberNormalized, r.description),
      }));
    }
    case "denied_party": {
      const rows = await db.deniedPartyWatchlist.findMany({
        select: { id: true, entityName: true, entityType: true, country: true, listSource: true, program: true },
        take: 10000,
      });
      return rows.map((r) => ({
        accountId: null,
        entityId: r.id,
        title: r.entityName,
        subtitle: joinText(r.listSource, r.country, r.program),
        href: "/app/compliance",
        searchText: joinText(r.entityName, r.entityType, r.country, r.listSource, r.program),
      }));
    }
    case "adcvd": {
      const rows = await db.adcvdOrder.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, caseNumber: true, title: true, respondentCountries: true, htsCodesInScope: true },
        take: 5000,
      });
      return rows.map((r) => ({
        accountId: null,
        entityId: r.id,
        title: `${r.caseNumber} — ${r.title}`,
        subtitle: r.respondentCountries.join(", "),
        href: "/app/regulatory",
        searchText: joinText(r.caseNumber, r.title, r.respondentCountries.join(" "), r.htsCodesInScope.join(" ")),
      }));
    }
    default:
      return [];
  }
}

async function indexKind(kind: SearchIndexKind): Promise<{ kind: SearchIndexKind; embedded: number; skippedUnchanged: number; candidates: number }> {
  // This job deliberately reads across every account to build one global
  // search index (each row still carries its own real accountId, read
  // directly off the source row) -- there is no single tenant to scope the
  // read to, which is exactly the documented cross-tenant background-job
  // case for an explicit `undefined` accountId context (see runWithAccountId
  // in packages/db/src/index.ts).
  const [candidates, existingHashes] = await runWithAccountId(undefined, () =>
    Promise.all([fetchCandidates(kind), SearchIndexRepository.existingHashes(kind)])
  );

  const changed = candidates.filter((c) => existingHashes.get(c.entityId) !== contentHash(c.searchText));
  const toEmbed = changed.slice(0, MAX_EMBED_PER_KIND_PER_RUN);

  let embedded = 0;
  for (const candidate of toEmbed) {
    const embedding = await HybridMemoryRetriever.embedQuery(candidate.searchText);
    await SearchIndexRepository.upsert({
      kind,
      entityId: candidate.entityId,
      accountId: candidate.accountId,
      title: candidate.title,
      subtitle: candidate.subtitle,
      href: candidate.href,
      searchText: candidate.searchText,
      contentHash: contentHash(candidate.searchText),
      embedding,
    });
    embedded += 1;
  }

  return { kind, embedded, skippedUnchanged: candidates.length - changed.length, candidates: candidates.length };
}

export const searchIndexRefreshJob = (inngest.createFunction as any)(
  { id: "search-index-refresh-job", triggers: [{ cron: "30 3 * * *" }, { event: "search-index/refresh.requested" }] },
  async ({ step, event }: { step: any; event: any }) => {
    const triggeredBy = event?.name === "search-index/refresh.requested" ? "MANUAL" : "CRON";
    const requestedKinds: SearchIndexKind[] | undefined = event?.data?.kinds;

    const logId: string = await step.run("create-run-log", async () => {
      const alreadyRunning = await db.datasetRefreshLog.findFirst({
        where: { datasetId: SEARCH_INDEX_DATASET_ID, status: "RUNNING" },
      });
      if (alreadyRunning) {
        throw new Error(`Search index refresh already has a run in progress (started ${alreadyRunning.startedAt.toISOString()}).`);
      }
      const log = await db.datasetRefreshLog.create({
        data: { datasetId: SEARCH_INDEX_DATASET_ID, datasetName: DATASET_NAME, triggeredBy, status: "RUNNING", startedAt: new Date() },
      });
      return log.id;
    });

    const kinds = requestedKinds && requestedKinds.length > 0 ? requestedKinds : SEARCH_INDEX_KINDS;

    try {
      const results: Awaited<ReturnType<typeof indexKind>>[] = [];
      for (const kind of kinds) {
        const result = await step.run(`index-${kind}`, () => indexKind(kind));
        results.push(result);
      }

      const totalEmbedded = results.reduce((sum, r) => sum + r.embedded, 0);
      await step.run("finalize-run-log-success", async () => {
        await db.datasetRefreshLog.update({
          where: { id: logId },
          data: {
            status: "SUCCESS",
            summary: results.map((r) => `${r.kind}: ${r.embedded} embedded / ${r.candidates} candidates`).join("; "),
            itemsIngested: totalEmbedded,
            completedAt: new Date(),
          },
        });
      });

      return { status: "SUCCESS", results };
    } catch (err: any) {
      await step.run("finalize-run-log-failure", async () => {
        await db.datasetRefreshLog.update({
          where: { id: logId },
          data: { status: "FAILED", errorMessage: err?.message || "Search index refresh failed", completedAt: new Date() },
        });
      });
      throw err;
    }
  }
);
