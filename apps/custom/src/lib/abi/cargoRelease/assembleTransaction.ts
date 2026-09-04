import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  buildHeader,
  buildAdditionalHeader,
  buildContactCancellation,
  buildBillOfLading,
  buildConveyance,
  buildEquipment,
  buildReference,
  buildHeaderEntity,
  buildHeaderEntityGbi,
  buildHeaderEntityAddress,
  buildHeaderEntityGeo,
  buildLineItem,
  buildFtzDetail,
  buildLineEntity,
  buildLineEntityGbi,
  buildLineEntityAddress,
  buildLineEntityGeo,
  buildHtsLine,
  buildFtzPfHts,
} from "./build";
import type { CargoReleaseTransactionInput } from "./types";

const MAX_BILLS = 999;
const MAX_SE15_PER_BILL = 3;
const MAX_CONVEYANCES_PER_BILL = 99;
const MAX_EQUIPMENT_PER_BILL = 99;
const MAX_REFERENCES = 99;
const MAX_HEADER_ENTITIES = 12;
const MAX_GBI_PER_ENTITY = 3;
const MAX_STREET_PER_ENTITY = 3;
const MAX_LINE_ITEMS = 9999;
const MAX_LINE_ENTITIES = 11;
const MAX_HTS_LINES_PER_ITEM = 32;

/**
 * Assembles one full ACE Cargo Release (SE) TRANSACTION grouping — header records,
 * repeating bill of lading groups (including conveyance and equipment), reference
 * records, header-level entity groups, line item record groups (including line
 * entities, HTS lines, and optional PGA lines) — into the flat, ordered 80-character
 * record strings expected by CBP.
 *
 * Source: docs/plans/catair-source-docs/04-cargo-release-implementation-guide-v40.pdf
 * Pages SE-22 through SE-25 (PDF pages 24-27).
 */
export function assembleTransaction(input: CargoReleaseTransactionInput): string[] {
  const records: string[] = [buildHeader(input.header)];

  if (input.additionalHeader) {
    records.push(buildAdditionalHeader(input.additionalHeader));
  }

  records.push(buildContactCancellation(input.contactCancellation));

  // Bill of Lading Grouping (SE15 + optional SE16 Conveyance + optional SE17 Equipment)
  if (input.bills && input.bills.length > 0) {
    if (input.bills.length > MAX_BILLS) {
      throw new AbiFixedWidthError(
        `Bill of Lading Grouping: ${input.bills.length} bill groups provided, exceeding spec limit of ${MAX_BILLS}.`
      );
    }
    for (const billGroup of input.bills) {
      if (billGroup.billsOfLading.length === 0 || billGroup.billsOfLading.length > MAX_SE15_PER_BILL) {
        throw new AbiFixedWidthError(
          `Bill of Lading Grouping: bill group has ${billGroup.billsOfLading.length} SE15 records, must be between 1 and ${MAX_SE15_PER_BILL}.`
        );
      }
      for (const bol of billGroup.billsOfLading) {
        records.push(buildBillOfLading(bol));
      }

      if (billGroup.conveyances && billGroup.conveyances.length > 0) {
        if (billGroup.conveyances.length > MAX_CONVEYANCES_PER_BILL) {
          throw new AbiFixedWidthError(
            `Conveyance Grouping: ${billGroup.conveyances.length} SE16 records provided for a bill group, exceeding spec limit of ${MAX_CONVEYANCES_PER_BILL}.`
          );
        }
        for (const conv of billGroup.conveyances) {
          records.push(buildConveyance(conv));
        }
      }

      if (billGroup.equipment && billGroup.equipment.length > 0) {
        if (billGroup.equipment.length > MAX_EQUIPMENT_PER_BILL) {
          throw new AbiFixedWidthError(
            `Equipment Grouping: ${billGroup.equipment.length} SE17 records provided for a bill group, exceeding spec limit of ${MAX_EQUIPMENT_PER_BILL}.`
          );
        }
        for (const eq of billGroup.equipment) {
          records.push(buildEquipment(eq));
        }
      }
    }
  }

  // Reference Information (SE20)
  if (input.references && input.references.length > 0) {
    if (input.references.length > MAX_REFERENCES) {
      throw new AbiFixedWidthError(
        `Reference Grouping: ${input.references.length} SE20 records provided, exceeding spec limit of ${MAX_REFERENCES}.`
      );
    }
    for (const ref of input.references) {
      records.push(buildReference(ref));
    }
  }

  // Header Level Entity Grouping (SE30 + optional SE31/SE35/SE36)
  if (input.headerEntities && input.headerEntities.length > 0) {
    if (input.headerEntities.length > MAX_HEADER_ENTITIES) {
      throw new AbiFixedWidthError(
        `Header Level Entity Grouping: ${input.headerEntities.length} SE30 entity groups provided, exceeding spec limit of ${MAX_HEADER_ENTITIES}.`
      );
    }
    for (const entityGroup of input.headerEntities) {
      records.push(buildHeaderEntity(entityGroup.entity));

      if (entityGroup.gbiIdentifiers && entityGroup.gbiIdentifiers.length > 0) {
        if (entityGroup.gbiIdentifiers.length > MAX_GBI_PER_ENTITY) {
          throw new AbiFixedWidthError(
            `Header Level Entity GBI Identifier Grouping: ${entityGroup.gbiIdentifiers.length} GBI identifiers provided for a header entity, exceeding spec limit of ${MAX_GBI_PER_ENTITY}.`
          );
        }
        for (const gbi of entityGroup.gbiIdentifiers) {
          records.push(buildHeaderEntityGbi(gbi));
        }
      }

      if (entityGroup.streetAddresses && entityGroup.streetAddresses.length > 0) {
        if (entityGroup.streetAddresses.length > MAX_STREET_PER_ENTITY) {
          throw new AbiFixedWidthError(
            `Header Entity Street Address Grouping: ${entityGroup.streetAddresses.length} street addresses provided for a header entity, exceeding spec limit of ${MAX_STREET_PER_ENTITY}.`
          );
        }
        for (const addr of entityGroup.streetAddresses) {
          records.push(buildHeaderEntityAddress(addr));
        }
      }

      if (entityGroup.geographicArea) {
        records.push(buildHeaderEntityGeo(entityGroup.geographicArea));
      }
    }
  }

  // SE Line Grouping (SE40 + optional SE41 + optional SE50/51/55/56 + SE60/61 + optional PGA lines)
  if (input.lines && input.lines.length > 0) {
    if (input.lines.length > MAX_LINE_ITEMS) {
      throw new AbiFixedWidthError(
        `SE Line Grouping: ${input.lines.length} line items provided, exceeding spec limit of ${MAX_LINE_ITEMS}.`
      );
    }

    for (const lineGroup of input.lines) {
      records.push(buildLineItem(lineGroup.lineItem));

      if (lineGroup.ftzStatus) {
        records.push(buildFtzDetail(lineGroup.ftzStatus));
      }

      // Line Level Entity Grouping (SE50 + optional SE51/SE55/SE56)
      if (lineGroup.entities && lineGroup.entities.length > 0) {
        if (lineGroup.entities.length > MAX_LINE_ENTITIES) {
          throw new AbiFixedWidthError(
            `Line Level Entity Grouping: ${lineGroup.entities.length} line entities provided, exceeding spec limit of ${MAX_LINE_ENTITIES}.`
          );
        }
        for (const lineEntityGroup of lineGroup.entities) {
          records.push(buildLineEntity(lineEntityGroup.entity));

          if (lineEntityGroup.gbiIdentifiers && lineEntityGroup.gbiIdentifiers.length > 0) {
            if (lineEntityGroup.gbiIdentifiers.length > MAX_GBI_PER_ENTITY) {
              throw new AbiFixedWidthError(
                `Line Level Entity GBI Identifier Grouping: ${lineEntityGroup.gbiIdentifiers.length} GBI identifiers provided for a line entity, exceeding spec limit of ${MAX_GBI_PER_ENTITY}.`
              );
            }
            for (const gbi of lineEntityGroup.gbiIdentifiers) {
              records.push(buildLineEntityGbi(gbi));
            }
          }

          if (lineEntityGroup.streetAddresses && lineEntityGroup.streetAddresses.length > 0) {
            if (lineEntityGroup.streetAddresses.length > MAX_STREET_PER_ENTITY) {
              throw new AbiFixedWidthError(
                `Line Entity Street Address Grouping: ${lineEntityGroup.streetAddresses.length} street addresses provided for a line entity, exceeding spec limit of ${MAX_STREET_PER_ENTITY}.`
              );
            }
            for (const addr of lineEntityGroup.streetAddresses) {
              records.push(buildLineEntityAddress(addr));
            }
          }

          if (lineEntityGroup.geographicArea) {
            records.push(buildLineEntityGeo(lineEntityGroup.geographicArea));
          }
        }
      }

      // Harmonized Tariff Schedule Grouping (SE60 + optional SE61)
      if (lineGroup.htsLines.length === 0 || lineGroup.htsLines.length > MAX_HTS_LINES_PER_ITEM) {
        throw new AbiFixedWidthError(
          `Harmonized Tariff Schedule Grouping: line item has ${lineGroup.htsLines.length} HTS lines, must be between 1 and ${MAX_HTS_LINES_PER_ITEM}.`
        );
      }

      for (const htsGroup of lineGroup.htsLines) {
        records.push(buildHtsLine(htsGroup.htsLine));

        if (htsGroup.ftzPfHts) {
          records.push(buildFtzPfHts(htsGroup.ftzPfHts));
        }
      }

      // PGA Grouping (raw encoded OI/PG lines)
      if (lineGroup.pgaLines && lineGroup.pgaLines.length > 0) {
        records.push(...lineGroup.pgaLines);
      }
    }
  }

  return records;
}
