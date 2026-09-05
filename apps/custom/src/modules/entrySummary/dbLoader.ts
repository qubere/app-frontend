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
 *
 * COLUMN-FACT SYNTHESIS: assembler.ts's own module doc says a DB-loading
 * unit is "responsible for turning 'the current column value' into a Fact
 * ... before calling this assembler" — this loader does exactly that via
 * `synthesizeColumnFacts` below. Many real shipments (anything entered
 * before the Fact-capture pipeline existed, or imported directly onto
 * `ShipmentLineItem` columns) have live `description`/`htsCode`/
 * `countryOfOrigin`/`quantity`/`totalValue` values with no corresponding
 * `Fact` row at all. Without this step, the assembler would correctly (per
 * its own contract) but uselessly mark every one of those blocks MISSING,
 * even though the value is sitting right there on the row — which is what a
 * live pass against a real shipment surfaced. Synthesized facts use
 * `sourceType: "EXTRACTED"` (the closest honest fit — see FieldProvenance's
 * `DOCUMENT` source) with a low, fixed confidence (`SYNTHESIZED_CONFIDENCE`)
 * so any genuine higher-confidence extracted Fact for the same field still
 * wins the precedence ladder's tie-break, and a deterministic
 * epoch-anchored `createdAt` so a genuine Fact with any real timestamp also
 * wins the "most recent" tie-break. They carry no `documentId` — there is
 * no document to point to, only the row itself.
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
import type { Rules7501Context } from "./validation/rules7501";
import { BOND_USABLE_STATUSES } from "./validation/rules7501";

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

/**
 * Confidence assigned to a synthesized column-fact. Deliberately lower than
 * any real extraction confidence would plausibly be, so a genuine Fact for
 * the same field always outranks it in `pickBestExtracted`'s precedence
 * tie-break — this is a floor, not a preferred source.
 */
export const SYNTHESIZED_FACT_CONFIDENCE = 1;

/** Always older than any real Fact's `createdAt`, so genuine facts win the "most recent" tie-break too. */
const SYNTHESIZED_FACT_CREATED_AT = new Date(0);

export interface ColumnFactSource {
  id: string;
  createdAt: Date;
}

/**
 * Builds one synthesized, traceable "column fact" for a live column value —
 * `null`/`undefined`/empty-string values are skipped entirely (nothing to
 * synthesize; the assembler correctly leaves the block MISSING).
 */
function columnFact(
  field: string,
  value: string | number | null | undefined,
  source: ColumnFactSource,
  entityRef: string | null
): AssemblerFactLike | null {
  if (value == null) return null;
  const stringValue = String(value);
  if (stringValue.length === 0) return null;
  return {
    id: `col:${source.id}:${field}`,
    field,
    value: stringValue,
    sourceType: "EXTRACTED",
    confidence: SYNTHESIZED_FACT_CONFIDENCE,
    documentId: null,
    documentPage: null,
    createdAt: SYNTHESIZED_FACT_CREATED_AT,
    entityRef,
  };
}

/**
 * Pure — exported and independently unit-tested
 * (tests/entry-summary-dbloader-column-facts.test.ts). Turns the live
 * column values on a shipment and its line items into `AssemblerFactLike`
 * entries the assembler's Fact-based precedence levels can actually see,
 * per the module-level "COLUMN-FACT SYNTHESIS" doc above.
 */
export function synthesizeColumnFacts(
  shipment: {
    id: string;
    createdAt: Date;
    entryType: string | null;
    portOfEntry: string | null;
    transportMode: string | null;
    countryOfExport: string | null;
  },
  lineItems: Array<{
    id: string;
    lineNumber: number;
    createdAt: Date;
    description: string | null;
    htsCode: string | null;
    countryOfOrigin: string | null;
    quantity: number | null;
    totalValue: unknown;
  }>
): AssemblerFactLike[] {
  const facts: AssemblerFactLike[] = [];

  const headerSource: ColumnFactSource = { id: `shipment:${shipment.id}`, createdAt: shipment.createdAt };
  const headerColumns: Array<[string, string | null]> = [
    ["entryType", shipment.entryType],
    ["portOfEntry", shipment.portOfEntry],
    ["modeOfTransport", shipment.transportMode],
    ["exportingCountry", shipment.countryOfExport],
  ];
  for (const [field, value] of headerColumns) {
    const fact = columnFact(field, value, headerSource, null);
    if (fact) facts.push(fact);
  }

  for (const li of lineItems) {
    const lineSource: ColumnFactSource = { id: `shipmentLineItem:${li.id}`, createdAt: li.createdAt };
    const entityRef = `line:${li.lineNumber}`;
    const lineColumns: Array<[string, string | number | null]> = [
      ["description", li.description],
      ["htsCode", li.htsCode],
      ["countryOfOrigin", li.countryOfOrigin],
      ["netQuantity", li.quantity],
      ["enteredValue", li.totalValue != null ? String(li.totalValue) : null],
    ];
    for (const [field, value] of lineColumns) {
      const fact = columnFact(field, value, lineSource, entityRef);
      if (fact) facts.push(fact);
    }
  }

  return facts;
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
  const shipment = await db.shipment.findFirst({
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
  });

  if (!shipment) throw new ShipmentNotFoundError(accountId, shipmentId);

  const facts = await db.fact.findMany({
    where: { shipmentId, supersededAt: null },
    orderBy: { createdAt: "desc" },
  });

  // GAP (documented): PgaRequirement carries no resolution/status column in
  // this schema — there is no genuine "resolved" signal to read, so every
  // requirement here is treated as unresolved. W7501.PGA.FLAG_UNRESOLVED is
  // WARNING-severity, so this never blocks export; it may over-fire relative
  // to a future schema that adds real resolution tracking.
  const pgaRequirementRows = await db.pgaRequirement.findMany({
    where: { shipmentLineItem: { shipmentId } },
    select: { shipmentLineItem: { select: { lineNumber: true } } },
  }).catch(() => [] as Array<{ shipmentLineItem: { lineNumber: number } }>);
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

  const parties: ShipmentPartyLike[] = await Promise.all(
    shipment.shipmentParties.map(async (p) => {
      const legalEntity = await db.legalEntity.findUnique({ where: { id: p.legalEntityId } }).catch(() => null);
      return {
        id: p.id,
        role: p.role,
        name: (legalEntity as { name?: string } | null)?.name ?? null,
        address: legalEntity ? addressToString((legalEntity as { address?: unknown }).address) : null,
      };
    })
  );

  const documents: ShipmentDocumentLike[] = shipment.documents.map((d) => ({
    id: d.id,
    docType: d.docType,
    status: d.status,
  }));

  const realFactLikes: AssemblerFactLike[] = facts.map((f) => ({
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

  const columnFacts = synthesizeColumnFacts(
    {
      id: shipment.id,
      createdAt: shipment.createdAt,
      entryType: shipment.entryType,
      portOfEntry: shipment.portOfEntry,
      transportMode: shipment.transportMode,
      countryOfExport: shipment.countryOfExport,
    },
    shipment.lineItems.map((li) => ({
      id: li.id,
      lineNumber: li.lineNumber,
      createdAt: li.createdAt,
      description: li.description,
      htsCode: li.htsCode,
      countryOfOrigin: li.countryOfOrigin,
      quantity: li.quantity,
      totalValue: li.totalValue,
    }))
  );

  // Real Facts first so the loader's own ordering also favors a genuine
  // extraction/user-entry record over a synthesized column fallback for
  // anyone inspecting `facts` directly (the assembler's own precedence
  // logic doesn't depend on array order, only on confidence/createdAt/id).
  const factLikes: AssemblerFactLike[] = [...realFactLikes, ...columnFacts];

  // GAP (choice b, documented above): always empty until AgentDecision/
  // FieldApproval carry a blockId.
  const approvedDecisions: AgentDecisionLike[] = [];
  const fieldApprovals: FieldApprovalLike[] = [];

  const hasCommercialInvoice = shipment.documents.some(
    (d) => d.docType.toLowerCase().includes("commercial invoice") && d.status.toLowerCase() !== "missing"
  );

  const powerOfAttorney = shipment.importerOfRecord?.powersOfAttorney[0] ?? null;

  const rulesContext: Rules7501Context = {
    entryDate: null,
    bond: bondRecord
      ? { status: bondRecord.status, expirationDate: bondRecord.expirationDate }
      : null,
    bondRequired: shipment.entryType != null,
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
