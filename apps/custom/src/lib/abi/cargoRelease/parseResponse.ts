import { decodeRecord, splitFixedWidthLines, AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  SE10_HEADER_SPEC,
  SE11_ADDITIONAL_HEADER_SPEC,
  SE13_CONTACT_CANCEL_SPEC,
  SE15_BILL_OF_LADING_SPEC,
  SE16_CONVEYANCE_SPEC,
  SE17_EQUIPMENT_SPEC,
  SE20_REFERENCE_SPEC,
  SE30_HEADER_ENTITY_SPEC,
  SE31_HEADER_ENTITY_GBI_SPEC,
  SE35_HEADER_ENTITY_ADDRESS_SPEC,
  SE36_HEADER_ENTITY_GEO_SPEC,
  SE40_LINE_ITEM_SPEC,
  SE41_FTZ_DETAIL_SPEC,
  SE50_LINE_ENTITY_SPEC,
  SE51_LINE_ENTITY_GBI_SPEC,
  SE55_LINE_ENTITY_ADDRESS_SPEC,
  SE56_LINE_ENTITY_GEO_SPEC,
  SE60_HTS_LINE_SPEC,
  SE61_FTZ_PF_HTS_SPEC,
  SE90_OUTPUT_DISPOSITION_SPEC,
} from "./recordSpecs";
import { classifyCargoReleaseLine } from "./parse";
import type {
  HeaderInput,
  AdditionalHeaderInput,
  ContactCancellationInput,
  BillOfLadingInput,
  ConveyanceInput,
  EquipmentInput,
  ReferenceInput,
  EntityInput,
  EntityGbiInput,
  EntityAddressInput,
  EntityGeoInput,
  LineItemInput,
  FtzDetailInput,
  HtsLineInput,
  FtzPfHtsInput,
  OutputDispositionInput,
  CargoReleaseResponseScenario,
  ParsedSeRecord,
  ParsedCargoReleaseHeaderGroup,
  ParsedCargoReleaseResponse,
} from "./types";

export function decodeHeader(line: string): HeaderInput {
  return decodeRecord(SE10_HEADER_SPEC, line);
}

export function decodeAdditionalHeader(line: string): AdditionalHeaderInput {
  return decodeRecord(SE11_ADDITIONAL_HEADER_SPEC, line);
}

export function decodeContactCancellation(line: string): ContactCancellationInput {
  return decodeRecord(SE13_CONTACT_CANCEL_SPEC, line);
}

export function decodeBillOfLading(line: string): BillOfLadingInput {
  return decodeRecord(SE15_BILL_OF_LADING_SPEC, line);
}

export function decodeConveyance(line: string): ConveyanceInput {
  return decodeRecord(SE16_CONVEYANCE_SPEC, line);
}

export function decodeEquipment(line: string): EquipmentInput {
  return decodeRecord(SE17_EQUIPMENT_SPEC, line);
}

export function decodeReference(line: string): ReferenceInput {
  return decodeRecord(SE20_REFERENCE_SPEC, line);
}

export function decodeHeaderEntity(line: string): EntityInput {
  return decodeRecord(SE30_HEADER_ENTITY_SPEC, line);
}

export function decodeHeaderEntityGbi(line: string): EntityGbiInput {
  return decodeRecord(SE31_HEADER_ENTITY_GBI_SPEC, line);
}

export function decodeHeaderEntityAddress(line: string): EntityAddressInput {
  return decodeRecord(SE35_HEADER_ENTITY_ADDRESS_SPEC, line);
}

export function decodeHeaderEntityGeo(line: string): EntityGeoInput {
  return decodeRecord(SE36_HEADER_ENTITY_GEO_SPEC, line);
}

export function decodeLineItem(line: string): LineItemInput {
  return decodeRecord(SE40_LINE_ITEM_SPEC, line);
}

export function decodeFtzDetail(line: string): FtzDetailInput {
  return decodeRecord(SE41_FTZ_DETAIL_SPEC, line);
}

export function decodeLineEntity(line: string): EntityInput {
  return decodeRecord(SE50_LINE_ENTITY_SPEC, line);
}

export function decodeLineEntityGbi(line: string): EntityGbiInput {
  return decodeRecord(SE51_LINE_ENTITY_GBI_SPEC, line);
}

export function decodeLineEntityAddress(line: string): EntityAddressInput {
  return decodeRecord(SE55_LINE_ENTITY_ADDRESS_SPEC, line);
}

export function decodeLineEntityGeo(line: string): EntityGeoInput {
  return decodeRecord(SE56_LINE_ENTITY_GEO_SPEC, line);
}

export function decodeHtsLine(line: string): HtsLineInput {
  return decodeRecord(SE60_HTS_LINE_SPEC, line);
}

export function decodeFtzPfHts(line: string): FtzPfHtsInput {
  return decodeRecord(SE61_FTZ_PF_HTS_SPEC, line);
}

export function decodeOutputDisposition(line: string): OutputDispositionInput {
  return decodeRecord(SE90_OUTPUT_DISPOSITION_SPEC, line);
}

type DraftHeaderGroup = Omit<ParsedCargoReleaseHeaderGroup, "scenario">;

/**
 * Walks raw response lines from CBP for ACE Cargo Release (SE) output,
 * building an array of SE Header Groupings (each repeating up to 999 times per output message,
 * PDF pages 28-29, SE-26/27). Scopes child records (bills, entities, lines) and per-occurrence
 * SE90 error records to their parent header grouping.
 */
export function parseCargoReleaseResponse(lines: string[]): ParsedCargoReleaseResponse {
  const headerGroups: ParsedCargoReleaseHeaderGroup[] = [];
  let currentGroup: DraftHeaderGroup | undefined;
  let activeErrorsTarget: OutputDispositionInput[] | undefined;
  const unrecognizedLines: string[] = [];

  for (const line of lines) {
    const code = classifyCargoReleaseLine(line);

    if (code === "SE10") {
      if (currentGroup) {
        headerGroups.push(finalizeHeaderGroup(currentGroup));
      }
      currentGroup = {
        header: { record: decodeHeader(line), errors: [] },
        bills: [],
        references: [],
        headerEntities: [],
        lines: [],
      };
      activeErrorsTarget = currentGroup.header.errors;
    } else if (code === "SE11") {
      if (!currentGroup) {
        throw new AbiFixedWidthError("Cargo Release response: SE11 record with no preceding SE10 Header.");
      }
      currentGroup.additionalHeader = { record: decodeAdditionalHeader(line), errors: [] };
      activeErrorsTarget = currentGroup.additionalHeader.errors;
    } else if (code === "SE13") {
      if (!currentGroup) {
        throw new AbiFixedWidthError("Cargo Release response: SE13 record with no preceding SE10 Header.");
      }
      currentGroup.contactCancellation = { record: decodeContactCancellation(line), errors: [] };
      activeErrorsTarget = currentGroup.contactCancellation.errors;
    } else if (code === "SE15") {
      if (!currentGroup) {
        throw new AbiFixedWidthError("Cargo Release response: SE15 record with no preceding SE10 Header.");
      }
      const parsedBill: ParsedSeRecord<BillOfLadingInput> = { record: decodeBillOfLading(line), errors: [] };
      currentGroup.bills.push({ bill: parsedBill, conveyances: [], equipment: [] });
      activeErrorsTarget = parsedBill.errors;
    } else if (code === "SE16") {
      if (!currentGroup || currentGroup.bills.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE16 Conveyance record with no preceding SE15 Bill of Lading.");
      }
      const parsedConv: ParsedSeRecord<ConveyanceInput> = { record: decodeConveyance(line), errors: [] };
      currentGroup.bills[currentGroup.bills.length - 1].conveyances.push(parsedConv);
      activeErrorsTarget = parsedConv.errors;
    } else if (code === "SE17") {
      if (!currentGroup || currentGroup.bills.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE17 Equipment record with no preceding SE15 Bill of Lading.");
      }
      const parsedEq: ParsedSeRecord<EquipmentInput> = { record: decodeEquipment(line), errors: [] };
      currentGroup.bills[currentGroup.bills.length - 1].equipment.push(parsedEq);
      activeErrorsTarget = parsedEq.errors;
    } else if (code === "SE20") {
      if (!currentGroup) {
        throw new AbiFixedWidthError("Cargo Release response: SE20 record with no preceding SE10 Header.");
      }
      const parsedRef: ParsedSeRecord<ReferenceInput> = { record: decodeReference(line), errors: [] };
      currentGroup.references.push(parsedRef);
      activeErrorsTarget = parsedRef.errors;
    } else if (code === "SE30") {
      if (!currentGroup) {
        throw new AbiFixedWidthError("Cargo Release response: SE30 record with no preceding SE10 Header.");
      }
      const parsedEntity: ParsedSeRecord<EntityInput> = { record: decodeHeaderEntity(line), errors: [] };
      currentGroup.headerEntities.push({ entity: parsedEntity, gbiIdentifiers: [], streetAddresses: [] });
      activeErrorsTarget = parsedEntity.errors;
    } else if (code === "SE31") {
      if (!currentGroup || currentGroup.headerEntities.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE31 Header Entity GBI record with no preceding SE30 Header Entity.");
      }
      const parsedGbi: ParsedSeRecord<EntityGbiInput> = { record: decodeHeaderEntityGbi(line), errors: [] };
      currentGroup.headerEntities[currentGroup.headerEntities.length - 1].gbiIdentifiers.push(parsedGbi);
      activeErrorsTarget = parsedGbi.errors;
    } else if (code === "SE35") {
      if (!currentGroup || currentGroup.headerEntities.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE35 Header Entity Address record with no preceding SE30 Header Entity.");
      }
      const parsedAddr: ParsedSeRecord<EntityAddressInput> = { record: decodeHeaderEntityAddress(line), errors: [] };
      currentGroup.headerEntities[currentGroup.headerEntities.length - 1].streetAddresses.push(parsedAddr);
      activeErrorsTarget = parsedAddr.errors;
    } else if (code === "SE36") {
      if (!currentGroup || currentGroup.headerEntities.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE36 Header Entity Geo record with no preceding SE30 Header Entity.");
      }
      const parsedGeo: ParsedSeRecord<EntityGeoInput> = { record: decodeHeaderEntityGeo(line), errors: [] };
      currentGroup.headerEntities[currentGroup.headerEntities.length - 1].geographicArea = parsedGeo;
      activeErrorsTarget = parsedGeo.errors;
    } else if (code === "SE40") {
      if (!currentGroup) {
        throw new AbiFixedWidthError("Cargo Release response: SE40 record with no preceding SE10 Header.");
      }
      const parsedLine: ParsedSeRecord<LineItemInput> = { record: decodeLineItem(line), errors: [] };
      currentGroup.lines.push({ lineItem: parsedLine, entities: [], htsLines: [], pgaLines: [] });
      activeErrorsTarget = parsedLine.errors;
    } else if (code === "SE41") {
      if (!currentGroup || currentGroup.lines.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE41 FTZ Detail record with no preceding SE40 Line Item.");
      }
      const parsedFtz: ParsedSeRecord<FtzDetailInput> = { record: decodeFtzDetail(line), errors: [] };
      currentGroup.lines[currentGroup.lines.length - 1].ftzStatus = parsedFtz;
      activeErrorsTarget = parsedFtz.errors;
    } else if (code === "SE50") {
      if (!currentGroup || currentGroup.lines.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE50 Line Entity record with no preceding SE40 Line Item.");
      }
      const parsedEntity: ParsedSeRecord<EntityInput> = { record: decodeLineEntity(line), errors: [] };
      currentGroup.lines[currentGroup.lines.length - 1].entities.push({ entity: parsedEntity, gbiIdentifiers: [], streetAddresses: [] });
      activeErrorsTarget = parsedEntity.errors;
    } else if (code === "SE51") {
      if (!currentGroup || currentGroup.lines.length === 0 || currentGroup.lines[currentGroup.lines.length - 1].entities.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE51 Line Entity GBI record with no preceding SE50 Line Entity.");
      }
      const currentLine = currentGroup.lines[currentGroup.lines.length - 1];
      const currentEntity = currentLine.entities[currentLine.entities.length - 1];
      const parsedGbi: ParsedSeRecord<EntityGbiInput> = { record: decodeLineEntityGbi(line), errors: [] };
      currentEntity.gbiIdentifiers.push(parsedGbi);
      activeErrorsTarget = parsedGbi.errors;
    } else if (code === "SE55") {
      if (!currentGroup || currentGroup.lines.length === 0 || currentGroup.lines[currentGroup.lines.length - 1].entities.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE55 Line Entity Address record with no preceding SE50 Line Entity.");
      }
      const currentLine = currentGroup.lines[currentGroup.lines.length - 1];
      const currentEntity = currentLine.entities[currentLine.entities.length - 1];
      const parsedAddr: ParsedSeRecord<EntityAddressInput> = { record: decodeLineEntityAddress(line), errors: [] };
      currentEntity.streetAddresses.push(parsedAddr);
      activeErrorsTarget = parsedAddr.errors;
    } else if (code === "SE56") {
      if (!currentGroup || currentGroup.lines.length === 0 || currentGroup.lines[currentGroup.lines.length - 1].entities.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE56 Line Entity Geo record with no preceding SE50 Line Entity.");
      }
      const currentLine = currentGroup.lines[currentGroup.lines.length - 1];
      const currentEntity = currentLine.entities[currentLine.entities.length - 1];
      const parsedGeo: ParsedSeRecord<EntityGeoInput> = { record: decodeLineEntityGeo(line), errors: [] };
      currentEntity.geographicArea = parsedGeo;
      activeErrorsTarget = parsedGeo.errors;
    } else if (code === "SE60") {
      if (!currentGroup || currentGroup.lines.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE60 HTS Line record with no preceding SE40 Line Item.");
      }
      const parsedHts: ParsedSeRecord<HtsLineInput> = { record: decodeHtsLine(line), errors: [] };
      currentGroup.lines[currentGroup.lines.length - 1].htsLines.push({ htsLine: parsedHts });
      activeErrorsTarget = parsedHts.errors;
    } else if (code === "SE61") {
      if (!currentGroup || currentGroup.lines.length === 0 || currentGroup.lines[currentGroup.lines.length - 1].htsLines.length === 0) {
        throw new AbiFixedWidthError("Cargo Release response: SE61 FTZ PF HTS record with no preceding SE60 HTS Line.");
      }
      const currentLine = currentGroup.lines[currentGroup.lines.length - 1];
      const currentHtsGroup = currentLine.htsLines[currentLine.htsLines.length - 1];
      const parsedFtzPf: ParsedSeRecord<FtzPfHtsInput> = { record: decodeFtzPfHts(line), errors: [] };
      currentHtsGroup.ftzPfHts = parsedFtzPf;
      activeErrorsTarget = parsedFtzPf.errors;
    } else if (code === "SE90") {
      const se90 = decodeOutputDisposition(line);
      const isTopLevelDisposition = ["01", "02", "03", "04"].includes(se90.messageTypeCode);
      if (isTopLevelDisposition) {
        if (currentGroup) {
          currentGroup.disposition = se90;
        } else {
          unrecognizedLines.push(line);
        }
      } else if (activeErrorsTarget) {
        activeErrorsTarget.push(se90);
      } else {
        unrecognizedLines.push(line);
      }
    } else {
      if (line.startsWith("OI") || line.startsWith("PG")) {
        if (currentGroup && currentGroup.lines.length > 0) {
          currentGroup.lines[currentGroup.lines.length - 1].pgaLines.push(line);
        } else {
          unrecognizedLines.push(line);
        }
      } else {
        unrecognizedLines.push(line);
      }
    }
  }

  if (currentGroup) {
    headerGroups.push(finalizeHeaderGroup(currentGroup));
  }

  if (headerGroups.length === 0) {
    throw new AbiFixedWidthError("Cargo Release response missing mandatory SE10 header record.");
  }

  const overallScenario = determineOverallScenario(headerGroups);

  return {
    scenario: overallScenario,
    headerGroups,
    unrecognizedLines,
  };
}

function finalizeHeaderGroup(draft: DraftHeaderGroup): ParsedCargoReleaseHeaderGroup {
  const scenario = determineGroupScenario(draft);
  return {
    ...draft,
    scenario,
  };
}

function determineGroupScenario(group: DraftHeaderGroup): CargoReleaseResponseScenario {
  if (group.disposition) {
    switch (group.disposition.messageTypeCode) {
      case "02":
        return "ACCEPTED";
      case "01":
        return "REJECTED";
      case "03":
        return "ACCEPTED_WITH_WARNINGS";
      case "04":
        return "REFERRED_TO_HUMAN_REVIEW";
      default:
        return "REJECTED";
    }
  }
  const hasErrors = hasAnyRecordErrors(group);
  return hasErrors ? "REJECTED" : "ACCEPTED";
}

function determineOverallScenario(groups: ParsedCargoReleaseHeaderGroup[]): CargoReleaseResponseScenario {
  if (groups.some(g => g.scenario === "REJECTED")) return "REJECTED";
  if (groups.some(g => g.scenario === "REFERRED_TO_HUMAN_REVIEW")) return "REFERRED_TO_HUMAN_REVIEW";
  if (groups.some(g => g.scenario === "ACCEPTED_WITH_WARNINGS")) return "ACCEPTED_WITH_WARNINGS";
  return "ACCEPTED";
}

/** Helper to check if any parsed record contains record-level errors ("11" or "13"). */
function hasAnyRecordErrors(res: Omit<ParsedCargoReleaseHeaderGroup, "scenario" | "disposition">): boolean {
  if (res.header.errors.length > 0) return true;
  if (res.additionalHeader?.errors.length) return true;
  if (res.contactCancellation?.errors.length) return true;
  if (res.bills.some(b => b.bill.errors.length || b.conveyances.some(c => c.errors.length) || b.equipment.some(e => e.errors.length))) return true;
  if (res.references.some(r => r.errors.length)) return true;
  if (res.headerEntities.some(e => e.entity.errors.length || e.gbiIdentifiers.some(g => g.errors.length) || e.streetAddresses.some(a => a.errors.length) || e.geographicArea?.errors.length)) return true;
  if (res.lines.some(l => l.lineItem.errors.length || l.ftzStatus?.errors.length || l.entities.some(e => e.entity.errors.length) || l.htsLines.some(h => h.htsLine.errors.length))) return true;
  return false;
}

/** Convenience function to split multi-line raw text before parsing. */
export function parseCargoReleaseResponseText(raw: string): ParsedCargoReleaseResponse {
  return parseCargoReleaseResponse(splitFixedWidthLines(raw));
}

