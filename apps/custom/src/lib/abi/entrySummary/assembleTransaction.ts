import { AbiFixedWidthError } from "@/lib/abi/fixedWidth";
import {
  buildHeaderControl,
  buildHeaderContent,
  buildBondDetail,
  buildHeaderFees,
  buildPscHeaderReasons,
  buildPscFilingExplanation,
  buildLineItemHeader,
  buildFtzStatus,
  buildInvoiceLineReference,
  buildRulingsDetail,
  buildCommercialDescription,
  buildLineEntity,
  buildLineEntityGbi,
  buildLineEntityStreetAddress,
  buildLineEntityGeographicArea,
  buildLineEntityGbiPartyType,
  buildHeaderEntity,
  buildHeaderEntityGbi,
  buildHeaderEntityStreetAddress,
  buildHeaderEntityGeographicArea,
  buildHeaderEntityGbiPartyType,
  buildArticleParty,
  buildStandardVisa,
  buildTariffDetail,
  buildFtzPrivilegedStatusDetail,
  buildLicenseCertificatePermit,
  buildAdcvdCaseDetail,
  buildImportersAdditionalDeclaration,
  buildIrTax,
  buildOtherRevenue,
  buildLineUserFee,
  buildPscLineReasons,
  buildCensusWarningOverride,
  buildAdcvdDutyTotals,
  buildFeeTotal,
  buildGrandTotals,
} from "./build";
import type { EntrySummaryTransactionInput } from "./types";

const MAX_BONDS = 2;
const MAX_PSC_EXPLANATIONS = 99;
const MAX_HEADER_ENTITIES = 12;
const MAX_LINE_ITEMS = 99999;
const MAX_ENTITIES = 11;
const MAX_GBI_PER_ENTITY = 4;
const MAX_STREET_PER_ENTITY = 3;
const MAX_GBI_PARTY_TYPE_DESCRIPTIONS = 9;
/** PDF page ESF-23's structure map says 6; the ESF-78 narrative says "up to
 * four times per Line Item", matching the 4 valid Party Type Codes (M/C/S/E)
 * one-for-one. Trusting the narrative — see ArticlePartyInput's doc comment. */
const MAX_ARTICLE_PARTIES = 4;
const MAX_TARIFF_DETAILS = 32;
const MAX_ADCVD_CASES = 2;
const MAX_DECLARATIONS = 9;
const MAX_USER_FEES = 9;
const MAX_FEE_TOTAL_RECORDS = 9;
const FEES_PER_RECORD = 5;

/**
 * Assembles one full Entry Summary TRANSACTION grouping — header records,
 * repeating line item record groups (including tariff, entity, invoice, AD/CVD,
 * declaration, tax, fee, and FTZ detail records), and totals records (88/89/90)
 * — into the flat, ordered 80-character record strings expected by CBP.
 *
 * Source: docs/plans/catair-source-docs/02-entry-summary-create-update-2026-07.pdf
 * Pages ESF-20 through ESF-25.
 */
export function assembleTransaction(input: EntrySummaryTransactionInput): string[] {
  const records: string[] = [buildHeaderControl(input.headerControl)];

  if (input.headerContent) {
    records.push(buildHeaderContent(input.headerContent));
  }

  if (input.bonds && input.bonds.length > 0) {
    if (input.bonds.length > MAX_BONDS) {
      throw new AbiFixedWidthError(
        `Bond Grouping: ${input.bonds.length} 31-Records provided, exceeding spec limit of ${MAX_BONDS}.`
      );
    }
    for (const bond of input.bonds) {
      records.push(buildBondDetail(bond));
    }
  }

  if (input.headerFees) {
    records.push(buildHeaderFees(input.headerFees));
  }

  if (input.pscHeaderReasons) {
    records.push(buildPscHeaderReasons(input.pscHeaderReasons));
  }

  if (input.pscFilingExplanations && input.pscFilingExplanations.length > 0) {
    if (input.pscFilingExplanations.length > MAX_PSC_EXPLANATIONS) {
      throw new AbiFixedWidthError(
        `PSC Filing Explanation Grouping: ${input.pscFilingExplanations.length} 36-Records provided, exceeding spec limit of ${MAX_PSC_EXPLANATIONS}.`
      );
    }
    for (const exp of input.pscFilingExplanations) {
      records.push(buildPscFilingExplanation(exp));
    }
  }

  // Header Level Cargo Entity Grouping (SE30 + optional SE31/SE32/SE35/SE36).
  // Only meaningful when certifying for combined ACE Cargo Release processing.
  if (input.headerEntities && input.headerEntities.length > 0) {
    if (input.headerEntities.length > MAX_HEADER_ENTITIES) {
      throw new AbiFixedWidthError(
        `Header Level Cargo Entity Grouping: ${input.headerEntities.length} SE30-Records provided, exceeding spec limit of ${MAX_HEADER_ENTITIES}.`
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
          if (gbi.partyTypeDescriptions && gbi.partyTypeDescriptions.length > 0) {
            if (gbi.partyTypeDescriptions.length > MAX_GBI_PARTY_TYPE_DESCRIPTIONS) {
              throw new AbiFixedWidthError(
                `Header Level GBI Party Type Description Grouping: ${gbi.partyTypeDescriptions.length} SE32-Records provided, exceeding spec limit of ${MAX_GBI_PARTY_TYPE_DESCRIPTIONS}.`
              );
            }
            gbi.partyTypeDescriptions.forEach((description, i) => {
              records.push(buildHeaderEntityGbiPartyType({ sequenceNumber: i + 1, description }));
            });
          }
        }
      }

      if (entityGroup.streetAddresses && entityGroup.streetAddresses.length > 0) {
        if (entityGroup.streetAddresses.length > MAX_STREET_PER_ENTITY) {
          throw new AbiFixedWidthError(
            `Header Entity Street Address Grouping: ${entityGroup.streetAddresses.length} street addresses provided for a header entity, exceeding spec limit of ${MAX_STREET_PER_ENTITY}.`
          );
        }
        for (const addr of entityGroup.streetAddresses) {
          records.push(buildHeaderEntityStreetAddress(addr));
        }
      }

      if (entityGroup.geographicArea) {
        records.push(buildHeaderEntityGeographicArea(entityGroup.geographicArea));
      }
    }
  }

  if (input.lineItems.length > MAX_LINE_ITEMS) {
    throw new AbiFixedWidthError(
      `Line Item Grouping: ${input.lineItems.length} line items provided, exceeding spec limit of ${MAX_LINE_ITEMS}.`
    );
  }

  for (const lineItem of input.lineItems) {
    records.push(buildLineItemHeader(lineItem.header));

    if (lineItem.ftzStatus) {
      records.push(buildFtzStatus(lineItem.ftzStatus));
    }

    // 42, 43, 44 Invoice/Ruling/Description Groupings
    if (lineItem.eipInvoices && lineItem.eipInvoices.length > 0) {
      for (const eipGroup of lineItem.eipInvoices) {
        records.push(buildInvoiceLineReference(eipGroup.invoice));
        if (eipGroup.ruling) {
          records.push(buildRulingsDetail(eipGroup.ruling));
        }
        if (eipGroup.commercialDescriptions) {
          for (const desc of eipGroup.commercialDescriptions) {
            records.push(buildCommercialDescription(desc));
          }
        }
      }
    } else {
      if (lineItem.invoices && lineItem.invoices.length > 0) {
        for (const inv of lineItem.invoices) {
          records.push(buildInvoiceLineReference(inv));
        }
      }
      if (lineItem.rulings && lineItem.rulings.length > 0) {
        for (const ruling of lineItem.rulings) {
          records.push(buildRulingsDetail(ruling));
        }
      } else if (lineItem.ruling) {
        records.push(buildRulingsDetail(lineItem.ruling));
      }
      if (lineItem.commercialDescriptions && lineItem.commercialDescriptions.length > 0) {
        for (const desc of lineItem.commercialDescriptions) {
          records.push(buildCommercialDescription(desc));
        }
      }
    }

    // Article Party Grouping (47)
    if (lineItem.articleParties && lineItem.articleParties.length > 0) {
      if (lineItem.articleParties.length > MAX_ARTICLE_PARTIES) {
        throw new AbiFixedWidthError(
          `Article Party Grouping: ${lineItem.articleParties.length} 47-Records provided, exceeding spec limit of ${MAX_ARTICLE_PARTIES}.`
        );
      }
      for (const articleParty of lineItem.articleParties) {
        records.push(buildArticleParty(articleParty));
      }
    }

    // Line Level Cargo Entity Grouping (SE50, SE51, SE55, SE56)
    if (lineItem.entities && lineItem.entities.length > 0) {
      if (lineItem.entities.length > MAX_ENTITIES) {
        throw new AbiFixedWidthError(
          `Line Level Cargo Entity Grouping: ${lineItem.entities.length} entities provided, exceeding spec limit of ${MAX_ENTITIES}.`
        );
      }
      for (const entityItem of lineItem.entities) {
        if ("entity" in entityItem) {
          records.push(buildLineEntity(entityItem.entity));
          if (entityItem.gbiIdentifiers && entityItem.gbiIdentifiers.length > 0) {
            if (entityItem.gbiIdentifiers.length > MAX_GBI_PER_ENTITY) {
              throw new AbiFixedWidthError(
                `Line Level Entity GBI Identifier Grouping: ${entityItem.gbiIdentifiers.length} GBI identifiers provided for an entity, exceeding spec limit of ${MAX_GBI_PER_ENTITY}.`
              );
            }
            for (const gbi of entityItem.gbiIdentifiers) {
              records.push(buildLineEntityGbi(gbi));
              if (gbi.partyTypeDescriptions && gbi.partyTypeDescriptions.length > 0) {
                if (gbi.partyTypeDescriptions.length > MAX_GBI_PARTY_TYPE_DESCRIPTIONS) {
                  throw new AbiFixedWidthError(
                    `Line Level GBI Party Type Description Grouping: ${gbi.partyTypeDescriptions.length} SE52-Records provided, exceeding spec limit of ${MAX_GBI_PARTY_TYPE_DESCRIPTIONS}.`
                  );
                }
                gbi.partyTypeDescriptions.forEach((description, i) => {
                  records.push(buildLineEntityGbiPartyType({ sequenceNumber: i + 1, description }));
                });
              }
            }
          }
          if (entityItem.streetAddresses && entityItem.streetAddresses.length > 0) {
            if (entityItem.streetAddresses.length > MAX_STREET_PER_ENTITY) {
              throw new AbiFixedWidthError(
                `Entity Street Address Grouping: ${entityItem.streetAddresses.length} street addresses provided for an entity, exceeding spec limit of ${MAX_STREET_PER_ENTITY}.`
              );
            }
            for (const addr of entityItem.streetAddresses) {
              records.push(buildLineEntityStreetAddress(addr));
            }
          }
          if (entityItem.geographicArea) {
            records.push(buildLineEntityGeographicArea(entityItem.geographicArea));
          }
        } else {
          records.push(buildLineEntity(entityItem));
        }
      }
    }

    // Tariff Grouping (50 + SE61)
    if (lineItem.tariffDetails.length === 0 || lineItem.tariffDetails.length > MAX_TARIFF_DETAILS) {
      throw new AbiFixedWidthError(
        `Tariff Grouping: line item has ${lineItem.tariffDetails.length} tariff details, must be between 1 and ${MAX_TARIFF_DETAILS}.`
      );
    }
    for (const tariffDetail of lineItem.tariffDetails) {
      records.push(buildTariffDetail(tariffDetail));
      // SE61: FTZ Privileged Foreign Status Additional Detail (PDF page ESF-92)
      // Reported at most once per 50-Record, immediately following its 50-Record.
      if (tariffDetail.ftzPrivilegedStatusDetail) {
        records.push(buildFtzPrivilegedStatusDetail(tariffDetail.ftzPrivilegedStatusDetail));
      }
    }

    // Standard Visa Information (51)
    if (lineItem.standardVisa) {
      records.push(buildStandardVisa(lineItem.standardVisa));
    }

    // License / Certificate / Permit Grouping (52)
    if (lineItem.licenseCertificatePermit) {
      records.push(buildLicenseCertificatePermit(lineItem.licenseCertificatePermit));
    } else if (lineItem.licenses && lineItem.licenses.length > 0) {
      for (const lic of lineItem.licenses) {
        records.push(buildLicenseCertificatePermit(lic));
      }
    }

    // AD/CVD Case Grouping (53)
    if (lineItem.adcvdCases && lineItem.adcvdCases.length > 0) {
      if (lineItem.adcvdCases.length > MAX_ADCVD_CASES) {
        throw new AbiFixedWidthError(
          `AD/CVD Case Grouping: ${lineItem.adcvdCases.length} 53-Records provided, exceeding spec limit of ${MAX_ADCVD_CASES}.`
        );
      }
      for (const caseDetail of lineItem.adcvdCases) {
        records.push(buildAdcvdCaseDetail(caseDetail));
      }
    }

    // Importer's Additional Declaration Grouping (54)
    if (lineItem.importersAdditionalDeclarations && lineItem.importersAdditionalDeclarations.length > 0) {
      if (lineItem.importersAdditionalDeclarations.length > MAX_DECLARATIONS) {
        throw new AbiFixedWidthError(
          `Importer's Additional Declaration Grouping: ${lineItem.importersAdditionalDeclarations.length} 54-Records provided, exceeding spec limit of ${MAX_DECLARATIONS}.`
        );
      }
      for (const decl of lineItem.importersAdditionalDeclarations) {
        records.push(buildImportersAdditionalDeclaration(decl));
      }
    }

    // IR Tax (60)
    if (lineItem.irTax) {
      records.push(buildIrTax(lineItem.irTax));
    }

    // Other Revenue (61)
    if (lineItem.otherRevenue) {
      records.push(buildOtherRevenue(lineItem.otherRevenue));
    }

    // Line User Fee Grouping (62)
    if (lineItem.userFees && lineItem.userFees.length > 0) {
      if (lineItem.userFees.length > MAX_USER_FEES) {
        throw new AbiFixedWidthError(
          `Line User Fee Grouping: ${lineItem.userFees.length} 62-Records provided, exceeding spec limit of ${MAX_USER_FEES}.`
        );
      }
      for (const fee of lineItem.userFees) {
        records.push(buildLineUserFee(fee));
      }
    }

    // PSC Line Reasons (63)
    if (lineItem.pscLineReasons) {
      records.push(buildPscLineReasons(lineItem.pscLineReasons));
    }

    // Census Warning Condition Override (CW02)
    if (lineItem.censusWarningOverride) {
      records.push(buildCensusWarningOverride(lineItem.censusWarningOverride));
    }
  }

  // Totals Grouping (88, 89, 90)
  if (input.adcvdDutyTotals) {
    records.push(buildAdcvdDutyTotals(input.adcvdDutyTotals));
  }

  if (input.feeTotals && input.feeTotals.length > 0) {
    const recordCount = Math.ceil(input.feeTotals.length / FEES_PER_RECORD);
    if (recordCount > MAX_FEE_TOTAL_RECORDS) {
      throw new AbiFixedWidthError(
        `Fee Total Grouping: ${input.feeTotals.length} fee entries need ${recordCount} 89-Records, exceeding the spec's limit of ${MAX_FEE_TOTAL_RECORDS}.`
      );
    }
    for (let i = 0; i < input.feeTotals.length; i += FEES_PER_RECORD) {
      records.push(buildFeeTotal(input.feeTotals.slice(i, i + FEES_PER_RECORD)));
    }
  }

  if (input.grandTotals) {
    records.push(buildGrandTotals(input.grandTotals));
  }

  return records;
}
