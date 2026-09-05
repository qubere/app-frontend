/**
 * DB-loading adapter for the 7501 entry summary draft (U12).
 *
 * The assembler (assembler.ts, U3) is deliberately pure and knows nothing
 * about Prisma. This module is "a future unit that reads the DB" its own
 * header refers to: it loads the real rows for one shipment and maps them
 * field-by-field into the assembler's `*Like` shapes, plus builds the
 * `Rules7501Context` the U6 rule pack needs.
 *
 * KNOWN GAP (documented per the issue's own instructions, choice (b)):
 * `AgentDecision` and `FieldApproval` predate this feature and have no
 * `blockId` column, so there is no reliable way to say "this AgentDecision
 * targets block B29A_HTSUS_NUMBER on line 3". Adding a nullable `blockId`
 * column to both tables (choice (a)) plus wiring every write path that
 * creates an AgentDecision/FieldApproval to populate it is real, multi-file
 * scope well beyond this pass. This loader therefore always passes empty
 * arrays for `approvedDecisions`/`fieldApprovals` — precedence levels 1
 * (FieldApproval) and 3 (approved AgentDecision) are reachable in the
 * assembler's contract (and unit-tested there) but never populated with real
 * data by this loader yet. Every field the assembler would otherwise resolve
 * from those levels instead resolves from level 5 (DOCUMENT/EXTRACTED Facts)
 * or MISSING. Follow-up: add `AgentDecision.blockId String?` /
 * `FieldApproval.blockId String?`, populate them from the entry-summary-aware
 * review UI, and wire them in here.
 *
 * Also out of scope here: Chapter 99 (301/232/201) additional-duty child
 * lines. No table in this schema records "line N also owes an extra duty
 * under program X" — `chapter99Lines` is always `[]`.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { openStatusVariants } from "@/modules/exceptions/exceptionState";
import type {
  AgentDecisionLike,
  AssemblerFactLike,
  AssemblerInput,
  BondLike,
  FieldApprovalLike,
  FilerProfileLike,
  ImporterOfRecordLike,
  ShipmentDocumentLike,
  ShipmentLike,
  ShipmentLineItemLike,
  ShipmentPartyLike,
} from "./assembler";
import { BOND_USABLE_STATUSES, type Rules7501Context } from "./validation/rules7501";
import { normalizeEntryType } from "@/modules/filing/entryType";

export interface LoadedShipmentForEntrySummary {
  assemblerInput: Omit<AssemblerInput, "filerProfile" | "clock">;
  rulesContext: Rules7501Context;
  shipmentNumber: string;
  filingId: string | null;
}

export class ShipmentNotFoundError extends Error {
  constructor(readonly accountId: string, readonly shipmentId: string) {
    super(`Shipment ${shipmentId} not found for account ${accountId}.`);
    this.name = "ShipmentNotFoundError";
  }
}

function addressToString(address: unknown): string | null {
  if (address == null) return null;
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    const a = address as Record<string, unknown>;
    const parts = [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(
      (p): p is string => typeof p === "string" && p.length > 0
    );
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}

/** Loads every row needed to assemble + validate a 7501 draft for one shipment. Account-scoped throughout (C6). */
export async function loadShipmentForEntrySummary(
  accountId: string,
  shipmentId: string
): Promise<LoadedShipmentForEntrySummary> {
  const [shipment, facts, pgaRequirementRows] = await Promise.all([
    db.shipment.findFirst({
      where: { id: shipmentId, accountId, deletedAt: null },
      include: {
        lineItems: { orderBy: { lineNumber: "asc" } },
        importerOfRecord: {
          include: {
            bond: true,
            powersOfAttorney: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        documents: { select: { id: true, docType: true, status: true } },
        shipmentParties: true,
        customsFilings: { select: { id: true, bondId: true, bond: true }, orderBy: { id: "desc" }, take: 1 },
        exceptionItems: { where: { status: { in: openStatusVariants() } }, select: { severity: true } },
        reconciliationIssues: { where: { status: "Open" }, select: { severity: true } },
      },
    }),
    db.fact.findMany({
      where: { shipmentId, supersededAt: null },
      orderBy: { createdAt: "desc" },
    }),
    // GAP (documented): PgaRequirement carries no resolution/status column in
    // this schema — there is no genuine "resolved" signal to read, so every
    // requirement here is treated as unresolved. W7501.PGA.FLAG_UNRESOLVED is
    // WARNING-severity, so this never blocks export; it may over-fire relative
    // to a future schema that adds real resolution tracking.
    db.pgaRequirement
      .findMany({
        where: { shipmentLineItem: { shipmentId } },
        select: { shipmentLineItem: { select: { lineNumber: true } } },
      })
      .catch(() => [] as Array<{ shipmentLineItem: { lineNumber: number } }>),
  ]);

  if (!shipment) throw new ShipmentNotFoundError(accountId, shipmentId);

  const pgaRequirements = pgaRequirementRows.map((p) => ({ lineNumber: p.shipmentLineItem.lineNumber, resolved: false }));

  const shipmentLike: ShipmentLike = {
    id: shipment.id,
    entryType: shipment.entryType,
    portOfEntry: shipment.portOfEntry,
    transportMode: shipment.transportMode,
    countryOfExport: shipment.countryOfExport,
    destinationCountry: shipment.destinationCountry,
    countryOfOrigin: shipment.countryOfOrigin,
  };

  const lineItems: ShipmentLineItemLike[] = shipment.lineItems.map((li) => ({
    id: li.id,
    lineNumber: li.lineNumber,
    // No Chapter 99 (301/232/201) source table exists yet — see module doc.
    chapter99Lines: [],
  }));

  const importerOfRecord: ImporterOfRecordLike | null = shipment.importerOfRecord
    ? {
        id: shipment.importerOfRecord.id,
        name: shipment.importerOfRecord.name,
        irsEin: shipment.importerOfRecord.irsEin,
        cbpImporterNumber: shipment.importerOfRecord.cbpImporterNumber,
        address: addressToString(shipment.importerOfRecord.address),
      }
    : null;

  const filingBond = shipment.customsFilings[0]?.bond ?? null;
  const bondRecord = filingBond ?? shipment.importerOfRecord?.bond ?? null;
  const bond: BondLike | null = bondRecord
    ? {
        id: bondRecord.id,
        bondNumber: bondRecord.bondNumber,
        bondType: bondRecord.bondType,
        suretyCode: bondRecord.suretyCode,
        status: bondRecord.status,
        expirationDate: bondRecord.expirationDate,
      }
    : null;

  const legalEntityIds = Array.from(
    new Set(shipment.shipmentParties.map((p) => p.legalEntityId).filter((id): id is string => Boolean(id)))
  );
  const legalEntities =
    legalEntityIds.length > 0 ? await db.legalEntity.findMany({ where: { id: { in: legalEntityIds } } }).catch(() => []) : [];
  const legalEntitiesById = new Map(legalEntities.map((le) => [le.id, le]));

  const parties: ShipmentPartyLike[] = shipment.shipmentParties.map((p) => {
    const legalEntity = p.legalEntityId ? legalEntitiesById.get(p.legalEntityId) ?? null : null;
    return {
      id: p.id,
      role: p.role,
      name: (legalEntity as { name?: string } | null)?.name ?? null,
      address: legalEntity ? addressToString((legalEntity as { address?: unknown }).address) : null,
    };
  });

  const documents: ShipmentDocumentLike[] = shipment.documents.map((d) => ({
    id: d.id,
    docType: d.docType,
    status: d.status,
  }));

  const factLikes: AssemblerFactLike[] = facts.map((f) => ({
    id: f.id,
    field: f.field,
    value: f.value,
    sourceType: f.sourceType,
    confidence: f.confidence,
    documentId: f.documentId,
    documentPage: f.documentPage,
    createdAt: f.createdAt,
    entityRef: f.entityRef,
  }));

  // GAP (choice b, documented above): always empty until AgentDecision/
  // FieldApproval carry a blockId.
  const approvedDecisions: AgentDecisionLike[] = [];
  const fieldApprovals: FieldApprovalLike[] = [];

  const hasCommercialInvoice = shipment.documents.some(
    (d) => d.docType.toLowerCase().includes("commercial invoice") && d.status.toLowerCase() !== "missing"
  );

  const powerOfAttorney = shipment.importerOfRecord?.powersOfAttorney[0] ?? null;

  const entryTypeCode = normalizeEntryType(shipment.entryType);

  const rulesContext: Rules7501Context = {
    entryDate: shipment.arrivalDate ?? shipment.estimatedArrival ?? new Date(),
    bond: bondRecord
      ? { status: bondRecord.status, expirationDate: bondRecord.expirationDate }
      : null,
    bondRequired: entryTypeCode != null ? !["11", "12"].includes(entryTypeCode) : false,
    powerOfAttorney: powerOfAttorney
      ? { status: powerOfAttorney.status, expirationDate: powerOfAttorney.expirationDate, revokedAt: powerOfAttorney.revokedAt }
      : null,
    pgaRequirements,
    openBlockingExceptionsCount: shipment.exceptionItems.filter((e) =>
      ["High", "Critical"].includes(e.severity)
    ).length,
    hasCommercialInvoice,
    importerOnboardingStatus: shipment.importerOfRecord?.registrationStatus === "registered" ? "active" : shipment.importerOfRecord?.registrationStatus ?? null,
    criticalReconciliationOpen: shipment.reconciliationIssues.some((r) => r.severity === "Critical"),
  };

  void BOND_USABLE_STATUSES; // re-exported for callers that want the same vocabulary

  return {
    assemblerInput: {
      shipment: shipmentLike,
      lineItems,
      importerOfRecord,
      bond,
      parties,
      facts: factLikes,
      documents,
      approvedDecisions,
      fieldApprovals,
    },
    rulesContext,
    shipmentNumber: (shipment as unknown as { shipmentNumber: string }).shipmentNumber,
    filingId: shipment.customsFilings[0]?.id ?? null,
  };
}

export type { Prisma };
