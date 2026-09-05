/**
 * Draft assembler (U3). Pure function: shipment facts in, EntrySummaryDraft
 * out. This file must never import the database client module — a test
 * asserts that on the module's own source text (see
 * tests/entry-summary-assembler.test.ts).
 *
 * Field precedence (C2/C3): every header/line block that can carry a
 * genuinely competing value goes through `resolveField`, which implements
 * the ladder from the issue exactly:
 *   1. FieldApproval (human confirmed)              -> USER
 *   2. Fact.sourceType === "USER_ENTERED"            -> USER
 *   3. Approved AgentDecision targeting the field    -> AGENT
 *   4. Master data (ImporterOfRecord/Bond/parties)   -> MASTER_DATA
 *   5. Highest-confidence Fact.sourceType==="EXTRACTED",
 *      ties by most-recent createdAt, then id asc    -> DOCUMENT
 *   6. FilerProfile.defaultPortCode (B06 ONLY)        -> FILER_PROFILE
 *   7. otherwise                                      -> MISSING
 *
 * Nothing here ever falls back to a raw Shipment/ShipmentLineItem column —
 * C2 explicitly bans defaulting a port code, importer number, bond number or
 * country, and this module treats every field that way for consistency: if
 * no FieldApproval/Fact/AgentDecision/MasterData/FilerProfile candidate
 * exists, the block is MISSING. A future unit that reads the DB is
 * responsible for turning "the current column value" into a Fact (or an
 * approval/decision) *before* calling this assembler — that is what keeps
 * this function pure and keeps every value traceable.
 *
 * B33/B34/B35/B37/B38/B39/B40 (duty, fees, totals) are intentionally left
 * MISSING here — U4's `bindDutyFields` fills them in as a second pass over
 * the assembled draft.
 */

import { Decimal } from "@/lib/tariff/decimal";
import type { Block, EntrySummaryDraft, EntrySummaryLine, HeaderBlockId, HeaderFields, LineBlockId, LineFields } from "./model";
import { HEADER_BLOCK_IDS, LINE_BLOCK_IDS } from "./model";
import type { EntrySummaryField, FieldProvenance } from "./provenance";

// ---------------------------------------------------------------------------
// "Like" input shapes — deliberately not 1:1 Prisma projections. A future
// (out-of-scope) unit that reads the DB is responsible for mapping real rows
// (Shipment, ShipmentLineItem, Fact, AgentDecision, FieldApproval, ...) into
// these shapes, including synthesizing Facts for "the column already holds
// this value" where that is genuinely traceable.
// ---------------------------------------------------------------------------

export interface ShipmentLike {
  id: string;
  entryType: string | null;
  portOfEntry: string | null;
  transportMode: string | null;
  countryOfExport: string | null;
  destinationCountry: string | null;
  countryOfOrigin: string | null;
}

export interface Chapter99LineInput {
  program: "301" | "232" | "201";
  htsCode: string;
  description?: string;
  agentDecisionId?: string;
}

export interface ShipmentLineItemLike {
  id: string;
  lineNumber: number;
  chapter99Lines?: Chapter99LineInput[];
}

export interface ImporterOfRecordLike {
  id: string;
  name: string | null;
  irsEin: string | null;
  cbpImporterNumber: string | null;
  address: string | null;
}

export interface BondLike {
  id: string;
  bondNumber: string | null;
  bondType: string | null;
  suretyCode: string | null;
  status: string;
  expirationDate: Date | string | null;
}

export interface ShipmentPartyLike {
  id: string;
  role: string; // e.g. "ULTIMATE_CONSIGNEE"
  name: string | null;
  address: string | null;
}

/** Fact-like row carrying the raw string value + provenance metadata needed to resolve a block. */
export interface AssemblerFactLike {
  id: string;
  field: string;
  value: string;
  sourceType: string; // "EXTRACTED" | "USER_ENTERED" | ...
  confidence?: number | null;
  documentId?: string | null;
  documentPage?: number | null;
  createdAt: Date | string;
  /** "line:<sourceLineNumber>" for a line-scoped fact, absent/null for header-scoped. */
  entityRef?: string | null;
}

export interface ShipmentDocumentLike {
  id: string;
  docType: string;
  status: string;
}

export interface AgentDecisionLike {
  id: string;
  /** "Approved" (matching AgentDecision.status) marks this decision usable at level 3. */
  status: string;
  blockId: Block;
  lineNumber?: number | null;
  value: string;
  confidence?: number | null;
}

export interface FieldApprovalLike {
  id: string;
  blockId: Block;
  lineNumber?: number | null;
  value: string;
}

export interface FilerProfileLike {
  id: string;
  filerCode: string | null;
  defaultPortCode: string | null;
}

export interface AssemblerInput {
  shipment: ShipmentLike;
  lineItems: ShipmentLineItemLike[];
  importerOfRecord: ImporterOfRecordLike | null;
  bond: BondLike | null;
  parties: ShipmentPartyLike[];
  facts: AssemblerFactLike[];
  documents: ShipmentDocumentLike[];
  approvedDecisions: AgentDecisionLike[];
  fieldApprovals: FieldApprovalLike[];
  filerProfile: FilerProfileLike;
  clock: () => Date;
}

// ---------------------------------------------------------------------------
// Generic precedence resolver
// ---------------------------------------------------------------------------

export interface PrecedenceCandidates<T> {
  fieldApproval?: { value: T; fieldApprovalId: string };
  userFact?: { value: T; fact: AssemblerFactLike };
  agentDecision?: { value: T; agentDecisionId: string; confidence?: number | null };
  masterData?: { value: T; record: { model: string; id: string } };
  extractedFacts?: Array<{ value: T; fact: AssemblerFactLike }>;
  /** Only ever meaningful for B06_PORT_CODE. */
  filerProfileDefault?: { value: T; filerProfileId: string };
}

function pickBestExtracted<T>(
  candidates: Array<{ value: T; fact: AssemblerFactLike }>
): { value: T; fact: AssemblerFactLike } | null {
  if (candidates.length === 0) return null;
  return candidates.slice().sort((a, b) => {
    const ca = a.fact.confidence ?? -Infinity;
    const cb = b.fact.confidence ?? -Infinity;
    if (cb !== ca) return cb - ca; // highest confidence first
    const ta = new Date(a.fact.createdAt).getTime();
    const tb = new Date(b.fact.createdAt).getTime();
    if (tb !== ta) return tb - ta; // most recent first
    if (a.fact.id < b.fact.id) return -1; // lowest id last (determinism)
    if (a.fact.id > b.fact.id) return 1;
    return 0;
  })[0];
}

/**
 * The precedence ladder, generic over any block and any value type. Exported
 * and directly unit-tested (tests/entry-summary-assembler.test.ts) with all
 * six levels supplied, so the ladder's own correctness does not depend on any
 * particular block in the real 7501 actually having six distinct real-world
 * sources — most blocks only ever populate 2-3 of these in practice.
 */
export function resolveField<T>(
  blockId: Block,
  candidates: PrecedenceCandidates<T>,
  clock: () => Date
): EntrySummaryField<T> {
  const asOf = () => clock().toISOString();

  if (candidates.fieldApproval) {
    return {
      blockId,
      value: candidates.fieldApproval.value,
      provenance: { source: "USER", fieldApprovalId: candidates.fieldApproval.fieldApprovalId, asOf: asOf() },
    };
  }
  if (candidates.userFact) {
    const provenance: FieldProvenance = {
      source: "USER",
      factId: candidates.userFact.fact.id,
      asOf: asOf(),
    };
    if (candidates.userFact.fact.documentId) provenance.documentId = candidates.userFact.fact.documentId;
    if (candidates.userFact.fact.documentPage != null) provenance.documentPage = candidates.userFact.fact.documentPage;
    return { blockId, value: candidates.userFact.value, provenance };
  }
  if (candidates.agentDecision) {
    const provenance: FieldProvenance = {
      source: "AGENT",
      agentDecisionId: candidates.agentDecision.agentDecisionId,
      asOf: asOf(),
    };
    if (candidates.agentDecision.confidence != null) provenance.confidence = candidates.agentDecision.confidence;
    return { blockId, value: candidates.agentDecision.value, provenance };
  }
  if (candidates.masterData) {
    return {
      blockId,
      value: candidates.masterData.value,
      provenance: { source: "MASTER_DATA", masterRecord: candidates.masterData.record, asOf: asOf() },
    };
  }
  const best = pickBestExtracted(candidates.extractedFacts ?? []);
  if (best) {
    const provenance: FieldProvenance = {
      source: "DOCUMENT",
      factId: best.fact.id,
      asOf: asOf(),
    };
    if (best.fact.documentId) provenance.documentId = best.fact.documentId;
    if (best.fact.documentPage != null) provenance.documentPage = best.fact.documentPage;
    if (best.fact.confidence != null) provenance.confidence = best.fact.confidence;
    return { blockId, value: best.value, provenance };
  }
  if (candidates.filerProfileDefault) {
    return {
      blockId,
      value: candidates.filerProfileDefault.value,
      provenance: {
        source: "FILER_PROFILE",
        masterRecord: { model: "FilerProfile", id: candidates.filerProfileDefault.filerProfileId },
        asOf: asOf(),
      },
    };
  }
  return { blockId, value: null, provenance: { source: "MISSING", asOf: asOf() } };
}

// ---------------------------------------------------------------------------
// Fact-field mapping: which Fact.field name feeds which block.
// ---------------------------------------------------------------------------

const HEADER_FACT_FIELD: Partial<Record<HeaderBlockId, string>> = {
  B02_ENTRY_TYPE: "entryType",
  B03_SUMMARY_DATE: "summaryDate",
  B04_SURETY_NUMBER: "suretyNumber",
  B05_BOND_TYPE: "bondType",
  B06_PORT_CODE: "portOfEntry",
  B07_ENTRY_DATE: "entryDate",
  B08_IMPORTING_CARRIER: "importingCarrier",
  B09_MODE_OF_TRANSPORT: "modeOfTransport",
  B11_IMPORT_DATE: "importDate",
  B12_BL_AWB_NUMBER: "blAwbNumber",
  B13_MANUFACTURER_ID: "manufacturerId",
  B14_EXPORTING_COUNTRY: "exportingCountry",
  B15_EXPORT_DATE: "exportDate",
  B16_IT_NUMBER: "itNumber",
  B17_IT_DATE: "itDate",
  B18_MISSING_DOCS: "missingDocs",
  B19_FOREIGN_PORT_OF_LADING: "foreignPortOfLading",
  B20_US_PORT_OF_UNLADING: "usPortOfUnlading",
  B21_LOCATION_OF_GOODS: "locationOfGoods",
  B22_CONSIGNEE_NUMBER: "consigneeNumber",
  B23_IMPORTER_NUMBER: "importerNumber",
  B24_REFERENCE_NUMBER: "referenceNumber",
  B25_ULTIMATE_CONSIGNEE_NAME: "ultimateConsigneeName",
  B25_ULTIMATE_CONSIGNEE_ADDRESS: "ultimateConsigneeAddress",
  B26_IMPORTER_OF_RECORD_NAME: "importerOfRecordName",
  B26_IMPORTER_OF_RECORD_ADDRESS: "importerOfRecordAddress",
  B41_DECLARANT_NAME: "declarantName",
  B42_DECLARANT_TITLE: "declarantTitle",
  B43_SIGNATURE_DATE: "signatureDate",
};

/** Blocks bound by U4 (duty/fees/totals) — assembler always leaves these MISSING. */
const DUTY_BOUND_HEADER_BLOCKS: readonly HeaderBlockId[] = [
  "B35_TOTAL_ENTERED_VALUE",
  "B37_TOTAL_DUTY",
  "B38_TOTAL_TAX",
  "B39_TOTAL_OTHER_FEES",
  "B40_TOTAL",
];

const LINE_FACT_FIELD: Partial<Record<LineBlockId, string>> = {
  B10_COUNTRY_OF_ORIGIN: "countryOfOrigin",
  B28_DESCRIPTION: "description",
  B29A_HTSUS_NUMBER: "htsCode",
  B29B_ADCVD_NUMBER: "adcvdNumber",
  B30A_GROSS_WEIGHT: "grossWeight",
  B30B_MANIFEST_QTY: "manifestQty",
  B31_NET_QUANTITY: "netQuantity",
  B32A_ENTERED_VALUE: "enteredValue",
  B32B_CHGS: "chgs",
  B32C_RELATIONSHIP: "relationship",
};

const DUTY_BOUND_LINE_BLOCKS: readonly LineBlockId[] = ["B33A_HTSUS_RATE", "B33B_ADCVD_RATE", "B33C_IRC_RATE", "B33D_VISA_NO", "B34_DUTY_TAX"];

const DECIMAL_LINE_BLOCKS: readonly LineBlockId[] = ["B30A_GROSS_WEIGHT", "B30B_MANIFEST_QTY", "B31_NET_QUANTITY", "B32A_ENTERED_VALUE", "B32B_CHGS"];

function tryParseDecimal(raw: string): Decimal | null {
  try {
    const d = new Decimal(raw);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Header assembly
// ---------------------------------------------------------------------------

function findFieldApproval(approvals: FieldApprovalLike[], blockId: Block, lineNumber: number | null): FieldApprovalLike | undefined {
  return approvals.find((a) => a.blockId === blockId && (a.lineNumber ?? null) === lineNumber);
}

function findApprovedAgentDecision(decisions: AgentDecisionLike[], blockId: Block, lineNumber: number | null): AgentDecisionLike | undefined {
  return decisions.find((d) => d.status === "Approved" && d.blockId === blockId && (d.lineNumber ?? null) === lineNumber);
}

function factsFor(facts: AssemblerFactLike[], field: string, entityRef: string | null): AssemblerFactLike[] {
  return facts.filter((f) => f.field === field && (f.entityRef ?? null) === entityRef);
}

function resolveHeaderStringBlock(
  blockId: HeaderBlockId,
  input: AssemblerInput
): EntrySummaryField<string> {
  const factField = HEADER_FACT_FIELD[blockId];
  const candidates: PrecedenceCandidates<string> = {};

  const approval = findFieldApproval(input.fieldApprovals, blockId, null);
  if (approval) candidates.fieldApproval = { value: approval.value, fieldApprovalId: approval.id };

  if (factField) {
    const matches = factsFor(input.facts, factField, null);
    const userFact = matches.find((f) => f.sourceType === "USER_ENTERED");
    if (userFact) candidates.userFact = { value: userFact.value, fact: userFact };
  }

  const agentDecision = findApprovedAgentDecision(input.approvedDecisions, blockId, null);
  if (agentDecision) candidates.agentDecision = { value: agentDecision.value, agentDecisionId: agentDecision.id, confidence: agentDecision.confidence };

  const masterData = resolveHeaderMasterData(blockId, input);
  if (masterData) candidates.masterData = masterData;

  if (factField) {
    const extracted = factsFor(input.facts, factField, null).filter((f) => f.sourceType === "EXTRACTED");
    if (extracted.length > 0) candidates.extractedFacts = extracted.map((f) => ({ value: f.value, fact: f }));
  }

  if (blockId === "B06_PORT_CODE" && input.filerProfile.defaultPortCode) {
    candidates.filerProfileDefault = { value: input.filerProfile.defaultPortCode, filerProfileId: input.filerProfile.id };
  }

  return resolveField(blockId, candidates, input.clock);
}

function resolveHeaderMasterData(blockId: HeaderBlockId, input: AssemblerInput): { value: string; record: { model: string; id: string } } | null {
  const ior = input.importerOfRecord;
  const bond = input.bond;
  switch (blockId) {
    case "B04_SURETY_NUMBER":
      return bond?.suretyCode ? { value: bond.suretyCode, record: { model: "Bond", id: bond.id } } : null;
    case "B05_BOND_TYPE":
      return bond?.bondType ? { value: bond.bondType, record: { model: "Bond", id: bond.id } } : null;
    case "B23_IMPORTER_NUMBER": {
      const value = ior?.cbpImporterNumber ?? ior?.irsEin ?? null;
      return ior && value ? { value, record: { model: "ImporterOfRecord", id: ior.id } } : null;
    }
    case "B26_IMPORTER_OF_RECORD_NAME":
      return ior?.name ? { value: ior.name, record: { model: "ImporterOfRecord", id: ior.id } } : null;
    case "B26_IMPORTER_OF_RECORD_ADDRESS":
      return ior?.address ? { value: ior.address, record: { model: "ImporterOfRecord", id: ior.id } } : null;
    case "B25_ULTIMATE_CONSIGNEE_NAME": {
      const party = input.parties.find((p) => p.role === "ULTIMATE_CONSIGNEE");
      return party?.name ? { value: party.name, record: { model: "ShipmentParty", id: party.id } } : null;
    }
    case "B25_ULTIMATE_CONSIGNEE_ADDRESS": {
      const party = input.parties.find((p) => p.role === "ULTIMATE_CONSIGNEE");
      return party?.address ? { value: party.address, record: { model: "ShipmentParty", id: party.id } } : null;
    }
    default:
      return null;
  }
}

function buildHeaderFields(input: AssemblerInput): HeaderFields {
  const fields = {} as HeaderFields;

  // B01 is dedicated FilerProfile config, not part of the general ladder.
  fields.B01_FILER_ENTRY_NUMBER = input.filerProfile.filerCode
    ? { blockId: "B01_FILER_ENTRY_NUMBER", value: input.filerProfile.filerCode, provenance: { source: "FILER_PROFILE", masterRecord: { model: "FilerProfile", id: input.filerProfile.id }, asOf: input.clock().toISOString() } }
    : { blockId: "B01_FILER_ENTRY_NUMBER", value: null, provenance: { source: "MISSING", asOf: input.clock().toISOString() } };

  for (const blockId of HEADER_BLOCK_IDS) {
    if (blockId === "B01_FILER_ENTRY_NUMBER") continue;
    if (DUTY_BOUND_HEADER_BLOCKS.includes(blockId)) {
      // Populated by U4's bindDutyFields; assembler leaves an explicit MISSING placeholder.
      (fields as Record<string, unknown>)[blockId] = {
        blockId,
        value: blockId === "B39_TOTAL_OTHER_FEES" ? null : null,
        provenance: { source: "MISSING", asOf: input.clock().toISOString() },
      };
      continue;
    }
    (fields as Record<string, unknown>)[blockId] = resolveHeaderStringBlock(blockId, input);
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Line assembly
// ---------------------------------------------------------------------------

function resolveLineStringBlock(blockId: LineBlockId, sourceLineNumber: number, input: AssemblerInput): EntrySummaryField<string> {
  const entityRef = `line:${sourceLineNumber}`;
  const factField = LINE_FACT_FIELD[blockId];
  const candidates: PrecedenceCandidates<string> = {};

  const approval = findFieldApproval(input.fieldApprovals, blockId, sourceLineNumber);
  if (approval) candidates.fieldApproval = { value: approval.value, fieldApprovalId: approval.id };

  if (factField) {
    const matches = factsFor(input.facts, factField, entityRef);
    const userFact = matches.find((f) => f.sourceType === "USER_ENTERED");
    if (userFact) candidates.userFact = { value: userFact.value, fact: userFact };
  }

  const agentDecision = findApprovedAgentDecision(input.approvedDecisions, blockId, sourceLineNumber);
  if (agentDecision) candidates.agentDecision = { value: agentDecision.value, agentDecisionId: agentDecision.id, confidence: agentDecision.confidence };

  if (factField) {
    const extracted = factsFor(input.facts, factField, entityRef).filter((f) => f.sourceType === "EXTRACTED");
    if (extracted.length > 0) candidates.extractedFacts = extracted.map((f) => ({ value: f.value, fact: f }));
  }

  return resolveField(blockId, candidates, input.clock);
}

function resolveLineDecimalBlock(blockId: LineBlockId, sourceLineNumber: number, input: AssemblerInput): EntrySummaryField<Decimal> {
  const stringField = resolveLineStringBlock(blockId, sourceLineNumber, input);
  if (stringField.value == null) return { blockId, value: null, provenance: stringField.provenance };
  const parsed = tryParseDecimal(stringField.value);
  if (parsed == null) return { blockId, value: null, provenance: { source: "MISSING", asOf: stringField.provenance.asOf } };
  return { blockId, value: parsed, provenance: stringField.provenance };
}

function buildLineFields(sourceLineNumber: number, input: AssemblerInput): LineFields {
  const fields = {} as LineFields;
  for (const blockId of LINE_BLOCK_IDS) {
    if (blockId === "B27_LINE_NUMBER") continue; // set by caller after renumbering
    if (DUTY_BOUND_LINE_BLOCKS.includes(blockId)) {
      (fields as Record<string, unknown>)[blockId] = { blockId, value: null, provenance: { source: "MISSING", asOf: input.clock().toISOString() } };
      continue;
    }
    if (DECIMAL_LINE_BLOCKS.includes(blockId)) {
      (fields as Record<string, unknown>)[blockId] = resolveLineDecimalBlock(blockId, sourceLineNumber, input);
    } else {
      (fields as Record<string, unknown>)[blockId] = resolveLineStringBlock(blockId, sourceLineNumber, input);
    }
  }
  return fields;
}

/**
 * A Chapter 99 additional-duty line shares the same commercial value, net
 * quantity, and country of origin as its parent — 301/232/201 duty is an
 * additional ad valorem rate on the *same* entered merchandise, not a
 * separately-valued line. Those three fields are carried over as COMPUTED
 * (copied from the parent), so U4's duty engine has a customs value to work
 * from; everything else on the child line is genuinely unknown and MISSING.
 */
function chapter99LineFields(child: Chapter99LineInput, parentFields: LineFields, input: AssemblerInput): LineFields {
  const fields = {} as LineFields;
  const asOf = input.clock().toISOString();
  const carriedOver: Partial<Record<LineBlockId, true>> = { B32A_ENTERED_VALUE: true, B31_NET_QUANTITY: true, B10_COUNTRY_OF_ORIGIN: true };

  for (const blockId of LINE_BLOCK_IDS) {
    if (blockId === "B27_LINE_NUMBER") continue;
    if (DUTY_BOUND_LINE_BLOCKS.includes(blockId)) {
      (fields as Record<string, unknown>)[blockId] = { blockId, value: null, provenance: { source: "MISSING", asOf } };
      continue;
    }
    if (blockId === "B29A_HTSUS_NUMBER") {
      (fields as Record<string, unknown>)[blockId] = child.agentDecisionId
        ? { blockId, value: child.htsCode, provenance: { source: "AGENT", agentDecisionId: child.agentDecisionId, asOf } }
        : { blockId, value: child.htsCode, provenance: { source: "COMPUTED", computedFrom: [`chapter99:${child.program}`], asOf } };
      continue;
    }
    if (blockId === "B28_DESCRIPTION") {
      const description = child.description ?? `Chapter 99 additional duty — Section ${child.program}`;
      (fields as Record<string, unknown>)[blockId] = { blockId, value: description, provenance: { source: "COMPUTED", computedFrom: [`chapter99:${child.program}`], asOf } };
      continue;
    }
    if (carriedOver[blockId]) {
      const parentField = (parentFields as Record<string, { value: unknown }>)[blockId];
      (fields as Record<string, unknown>)[blockId] =
        parentField.value != null
          ? { blockId, value: parentField.value, provenance: { source: "COMPUTED", computedFrom: [`parentLine.${blockId}`], asOf } }
          : { blockId, value: null, provenance: { source: "MISSING", asOf } };
      continue;
    }
    (fields as Record<string, unknown>)[blockId] = { blockId, value: null, provenance: { source: "MISSING", asOf } };
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function assembleEntrySummaryDraft(input: AssemblerInput): EntrySummaryDraft {
  const header = { fields: buildHeaderFields(input) };

  const sortedLineItems = [...input.lineItems].sort((a, b) => a.lineNumber - b.lineNumber);

  const lines: EntrySummaryLine[] = [];
  let draftLineNumber = 0;

  for (const li of sortedLineItems) {
    draftLineNumber += 1;
    const parentDraftLineNumber = draftLineNumber;
    const fields = buildLineFields(li.lineNumber, input);
    fields.B27_LINE_NUMBER = { blockId: "B27_LINE_NUMBER", value: parentDraftLineNumber, provenance: { source: "COMPUTED", computedFrom: ["lineNumber"], asOf: input.clock().toISOString() } };
    lines.push({
      lineNumber: parentDraftLineNumber,
      sourceLineNumber: li.lineNumber,
      parentLineNumber: null,
      fields,
    });

    for (const child of li.chapter99Lines ?? []) {
      draftLineNumber += 1;
      const childFields = chapter99LineFields(child, fields, input);
      childFields.B27_LINE_NUMBER = { blockId: "B27_LINE_NUMBER", value: draftLineNumber, provenance: { source: "COMPUTED", computedFrom: ["lineNumber"], asOf: input.clock().toISOString() } };
      lines.push({
        lineNumber: draftLineNumber,
        sourceLineNumber: li.lineNumber,
        parentLineNumber: parentDraftLineNumber,
        fields: childFields,
      });
    }
  }

  return {
    header,
    lines,
    generatedAt: input.clock().toISOString(),
  };
}
