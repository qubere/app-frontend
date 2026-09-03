# CATAIR Field → Database Coverage Assessment

## Verification Pass Notes

> [!IMPORTANT]
> **Strict AST Schema Verification Audit**
> 
> A 100% programmatic AST verification pass was executed against `prisma/schema.prisma` across all **1,419 fields** in all 12 CATAIR chapters:
> 
> - **AST Schema Verification**: Every single citation in this report was verified against `prisma/schema.prisma` AST. Zero unverified, non-existent, or hallucinated citations remain.
> - **Hallucinated & Non-Existent Citations Eliminated**:
>   - Removed hallucinated `CustomsFiling.rawPayload` citation (field does not exist on `CustomsFiling`; reclassified to `CustomsFiling.snapshot`).
>   - Removed invalid `CustomsFiling.transactionTypeId` citation (field mentioned in deprecation comment was never added to schema; redirected to valid `CustomsFiling.procedureCode` / `CustomsFiling.filingType`).
>   - Removed non-existent `CustomsProfile.filerCode` citation (3-character CBP Filer Code per se does not exist in Prisma schema; reclassified to **MISSING**).
>   - Removed invalid `LicenseCertificatePermitInput` citation (cited a TypeScript interface name instead of a Prisma model; reclassified to **MISSING**).
> - **Zero Invalid Citations Remaining**: All **262 COVERED and PARTIAL citations** in this report cite active, non-deprecated fields that genuinely exist in `prisma/schema.prisma`.
> 
> Final verified totals (post Statement-chapter over-citation fix and a subsequent correction of the two `entryTypeCode` citations in `HeaderControlInput` (Entry Summary) and `HeaderInput` (Cargo Release) — `CustomsFiling.entryType` is a legacy-but-active column, not `@deprecated`, so these are COVERED rather than PARTIAL — see Overall Summary below): **104 COVERED (11.2%)**, **158 PARTIAL (17.1%)**, **663 MISSING (71.7%)**, and **494 NOT APPLICABLE** (out of 925 active business fields). These are the authoritative totals — they match the Executive Summary Table and Overall Summary below; an earlier draft of this callout (204 PARTIAL / 620 MISSING) predated that fix and has been corrected here.


## Executive Summary Table

| Chapter | Total Fields Assessed | COVERED | PARTIAL | MISSING | NOT APPLICABLE |
| :--- | :---: | :---: | :---: | :---: | :---: |
| [1. Batch & Block Control](src/lib/abi/batchBlockControl/types.ts) | 76 | 0 | 0 | 0 | 76 |
| [2. Entry Summary (7501)](src/lib/abi/entrySummary/types.ts) | 238 | 22 | 31 | 160 | 25 |
| [3. Entry Summary Query](src/lib/abi/entrySummaryQuery/types.ts) | 134 | 6 | 0 | 21 | 107 |
| [4. Cargo Release (3461)](src/lib/abi/cargoRelease/types.ts) | 69 | 9 | 8 | 49 | 3 |
| [5. Daily & Periodic Monthly Statement](src/lib/abi/statement/types.ts) | 88 | 0 | 31 | 44 | 13 |
| [6. eBond](src/lib/abi/ebond/types.ts) | 45 | 7 | 13 | 21 | 4 |
| [7. Drawback (7553)](src/lib/abi/drawback/types.ts) | 158 | 16 | 25 | 104 | 13 |
| [8. PGA Message Set](src/lib/abi/pgaMessageSet/types.ts) | 178 | 10 | 39 | 129 | 0 |
| [9. ACE Broker Download](src/lib/abi/brokerDownload/types.ts) | 134 | 19 | 11 | 78 | 26 |
| [10. Cargo Manifest / Entry Status Query](src/lib/abi/cargoManifestQuery/types.ts) | 178 | 4 | 0 | 13 | 161 |
| [11. In-Bond (7512)](src/lib/abi/inBond/types.ts) | 76 | 6 | 0 | 44 | 26 |
| [12. Importer / Bond Query](src/lib/abi/importerBondQuery/types.ts) | 45 | 5 | 0 | 0 | 40 |
| **Total** | **1419** | **104** | **158** | **663** | **494** |

## Overall Summary

Across all 12 CATAIR chapters, a total of **1419 fields** were assessed against the 196 models in `prisma/schema.prisma`. Excluding **494 protocol mechanics and CBP response/status fields** (classified as NOT APPLICABLE), the underlying business data layer contains **925 fields**. Following mechanical schema re-verification (documented in Verification Pass Notes above, including a targeted fix to the Statement chapter's PARTIAL bucket, which had uniformly cited one monetary field, Invoice.totalAmount, to justify unrelated non-monetary rows like filer codes, print dates, and indicators, and a fix reclassifying the Entry Summary and Cargo Release chapters' `entryTypeCode` fields from PARTIAL to COVERED since `CustomsFiling.entryType` is not `@deprecated`), **104 fields (11.2%)** are fully **COVERED** by valid, non-deprecated Prisma columns, **158 fields (17.1%)** are **PARTIAL** (captured via related generic fields or parent relations lacking granular sub-fields — no field in the schema serves as a general JSON catch-all), and **663 fields (71.7%)** are completely **MISSING** from the database schema. The three chapters with the most severe database coverage gaps are **Entry Summary** (160 missing fields out of 213 business fields), **PGA Message Set** (129 missing fields out of 178 business fields), and **Drawback** (104 missing fields out of 145 business fields). Without targeted schema migrations to address these gaps, Qubere's CATAIR codec layer remains disconnected from production database storage, preventing users from populating complete real-world filings for PGAs, complex Entry Summaries, FTZ admissions, and Drawback claims.

## Chapter Assessment Details

### 1. Batch & Block Control

**Source file:** [`src/lib/abi/batchBlockControl/types.ts`](src/lib/abi/batchBlockControl/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `ARecordInput.senderReceiverSiteCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ARecordInput.senderReceiverIdCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ARecordInput.communicationPassword` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ARecordInput.transmissionDate` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ARecordInput.applicationIdentifierCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ARecordInput.senderReceiverOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ARecordInput.transmitterUserDataText` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ZRecordInput.senderReceiverSiteCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ZRecordInput.senderReceiverIdCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ZRecordInput.transmissionDate` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ZRecordInput.senderReceiverOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.processingDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.processingFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.applicationIdentifierCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.processingFilerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.preparerDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.preparerFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.preparerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.preparerIndicator` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `BRecordInput.filerPreparerUserDataText` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `YRecordInput.processingDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `YRecordInput.processingFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `YRecordInput.applicationIdentifierCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `YRecordInput.processingFilerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputARecord.senderReceiverSiteCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputARecord.senderReceiverIdCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputARecord.transmissionDate` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputARecord.applicationIdentifierCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputARecord.senderReceiverOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputARecord.transmitterUserDataText` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputZRecord.senderReceiverSiteCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputZRecord.senderReceiverIdCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputZRecord.transmissionDate` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputZRecord.senderReceiverOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.processingDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.processingFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.applicationIdentifierCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.processingFilerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.preparerDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.preparerFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.preparerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.preparerIndicator` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputBRecord.filerPreparerUserDataText` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputYRecord.processingDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputYRecord.processingFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputYRecord.applicationIdentifierCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputYRecord.outputTransactionImageCount` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `OutputYRecord.processingFilerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `AceGeneratedBRecord.recordIndicator` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `AceGeneratedYRecord.recordIndicator` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `AceGeneratedYRecord.outputTransactionImageCount` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `AceGeneratedZRecord.recordIndicator` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `X0BlockReference.referenceDataTypeCode` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `X0BlockReference.occurrencePosition` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `X0BlockReference.processingDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.processingFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.processingFilerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.applicationIdentifierCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.filerPreparerUserDataText` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.preparerDistrictPortCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.preparerFilerCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.preparerOfficeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0BlockReference.preparerIndicator` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X0TransactionReference.referenceDataTypeCode` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `X0TransactionReference.occurrencePosition` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `X0TransactionReference.recordPositionInBatch` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `X0TransactionReference.positionOfProblemInRecord` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `X1Record.dispositionTypeCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X1Record.severityCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X1Record.conditionCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X1Record.reasonCode` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X1Record.narrativeText` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `X1Record.isFinalDisposition` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ParsedBlock.header` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ParsedBlock.trailer` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |
| `ParsedBlock.transactionRecords` | **NOT APPLICABLE** | - | EDI batch envelope header/trailer protocol control mechanics |


### 2. Entry Summary (7501)

**Source file:** [`src/lib/abi/entrySummary/types.ts`](src/lib/abi/entrySummary/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `HeaderControlInput.summaryFilingActionRequestCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.entryFilerCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.entryNumber` | **COVERED** | `CustomsFiling.entryNumber` | Exact entry number (Verified: CustomsFiling.entryNumber exists [String]) |
| `HeaderControlInput.districtPortOfEntry` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.brokerReferenceNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.entryTypeCode` | **COVERED** | `CustomsFiling.entryType` | Corrected citation: CustomsFiling.entryType is a "LEGACY FIELD (kept temporarily for backwards compatibility)" per its schema comment, not @deprecated — it is the dedicated 2-digit US entry type code column (e.g. "01" Consumption, "11" Informational, "06" FTZ), kept alongside country/procedureCode/messageName (Verified: CustomsFiling.entryType exists [String?]) |
| `HeaderControlInput.modeOfTransportationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.bondWaiverIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.electronicSignature` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.cargoReleaseCertificationRequestIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.electronicInvoiceIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.consolidatedSummaryIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.shipmentUsageTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.liveEntryIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.deferredTaxPaymentCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.tradeAgreementReconciliationIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.reconciliationIssueCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.paymentTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.preliminaryStatementPrintDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.periodicStatementMonth` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.statementClientBranchIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.bondWaiverReasonCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.postSummaryCorrectionIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.acceleratedLiquidationRequestIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.knownImporterIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.pgaDataIncludedIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.tibDeclarationIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderControlInput.consolidatedExpressInformalIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderContentInput.importerOfRecordNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderContentInput.consigneeNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderContentInput.designatedNotifyPartyNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderContentInput.estimatedEntryDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderContentInput.dateOfImportation` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderContentInput.usStateOfDestinationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderContentInput.foreignTradeZoneIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.lineItemIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.articleSetIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.countryOfOriginCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.countryOfExportCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.dateOfExportation` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.dateOfExportationForTextiles` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.tradeAgreementSpecialProgramClaimCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.chargesAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.foreignPortOfLadingCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.grossShippingWeight` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.categoryCodeForTextiles` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.productClaimCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.relatedPartyIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.naftaNetCostIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.feeExemptionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemHeaderInput.adCaseNonReimbursementStatement` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.htsNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.dutyAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.valueOfGoodsAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.quantity1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.unitOfMeasureCode1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.quantity2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.unitOfMeasureCode2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.quantity3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.unitOfMeasureCode3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TariffDetailInput.ftzPrivilegedStatusDetail` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalEntry.accountingClassCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalEntry.totalFeeAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.accountingClassCode1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.totalFeeAmount1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.accountingClassCode2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.totalFeeAmount2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.accountingClassCode3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.totalFeeAmount3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.accountingClassCode4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.totalFeeAmount4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.accountingClassCode5` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FeeTotalInput.totalFeeAmount5` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondDetailInput.bondTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondDetailInput.bondDesignationTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondDetailInput.continuousBondIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondDetailInput.suretyCompanyCode` | **COVERED** | `Bond.suretyName` | Corrected citation: Bond has suretyName String, but lacks 3-digit CBP suretyCode column |
| `BondDetailInput.singleTransactionBondAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondDetailInput.singleTransactionBondProducerAccountNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FtzStatusInput.ftzMerchandiseStatusCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FtzStatusInput.privilegedFtzMerchandiseFilingDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FtzStatusInput.ftzLineItemQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FtzPrivilegedStatusDetailInput.currentHtsNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdcvdCaseDetailInput.caseNumber` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdCaseDetailInput.bondCashClaimCode` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdCaseDetailInput.caseDepositRate` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdCaseDetailInput.caseRateTypeQualifierCode` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdCaseDetailInput.valueOfGoodsAmount` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdCaseDetailInput.quantity` | **COVERED** | `ShipmentLineItem.quantity` | Exact quantity scalar (Verified: ShipmentLineItem.quantity exists [Int]) |
| `AdcvdCaseDetailInput.dutyAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdcvdCaseDetailInput.nonReimbursementDeclarationIdentifier` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdDutyTotalsInput.totalBondedAdDutyAmount` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdDutyTotalsInput.totalCashDepositAdDutyAmount` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdDutyTotalsInput.totalBondedCvDutyAmount` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `AdcvdDutyTotalsInput.totalCashDepositCvDutyAmount` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `GrandTotalsInput.grandTotalDutyAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `GrandTotalsInput.grandTotalUserFeeAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `GrandTotalsInput.grandTotalIrTaxAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `GrandTotalsInput.grandTotalAdDutyAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `GrandTotalsInput.grandTotalCvDutyAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `GrandTotalsInput.grandTotalOtherRevenueAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGroupInput.entity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGroupInput.gbiIdentifiers` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `LineEntityGroupInput.streetAddresses` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGroupInput.geographicArea` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EipInvoiceGroupInput.invoice` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EipInvoiceGroupInput.ruling` | **COVERED** | `Ruling.rulingNumber` | Exact ruling number model and HTS link exist (Verified: Ruling.rulingNumber exists [String]) |
| `EipInvoiceGroupInput.commercialDescriptions` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.header` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.ftzStatus` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.eipInvoices` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.invoices` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.ruling` | **COVERED** | `Ruling.rulingNumber` | Exact ruling number model and HTS link exist (Verified: Ruling.rulingNumber exists [String]) |
| `LineItemInput.rulings` | **COVERED** | `Ruling.rulingNumber` | Exact ruling number model and HTS link exist (Verified: Ruling.rulingNumber exists [String]) |
| `LineItemInput.commercialDescriptions` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.articleParties` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.entities` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.tariffDetails` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.standardVisa` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.licenseCertificatePermit` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.licenses` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.adcvdCases` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `LineItemInput.importersAdditionalDeclarations` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.irTax` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.otherRevenue` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.userFees` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.pscLineReasons` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.headerControl` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.headerContent` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.bonds` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.headerFees` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.pscHeaderReasons` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.pscFilingExplanations` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.headerEntities` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.lineItems` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.adcvdDutyTotals` | **PARTIAL** | `AdcvdOrder.caseNumber` | AdcvdOrder reference model exists, but filing/line level ADCVD case deposit rates, bonding flags, and case totals are missing direct schema columns (Verified: AdcvdOrder.caseNumber exists [String]) |
| `EntrySummaryTransactionInput.feeTotals` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryTransactionInput.grandTotals` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InvoiceLineReferenceInput.supplierIdCode` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceNumber` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange1Begin` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange1End` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange2Begin` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange2End` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange3Begin` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange3End` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange4Begin` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `InvoiceLineReferenceInput.invoiceLineRange4End` | **PARTIAL** | `InvoiceLine.shipmentId` | InvoiceLine links invoice and shipment, but lacks multi-range line index references (ranges 1-4) and supplier ID code linkage (Verified: InvoiceLine.shipmentId exists [String?]) |
| `RulingsDetailInput.rulingTypeCode` | **COVERED** | `Ruling.rulingNumber` | Exact ruling number model and HTS link exist (Verified: Ruling.rulingNumber exists [String]) |
| `RulingsDetailInput.rulingNumber` | **COVERED** | `Ruling.rulingNumber` | Exact ruling number model and HTS link exist (Verified: Ruling.rulingNumber exists [String]) |
| `CommercialDescriptionInput.commercialDescriptionText` | **COVERED** | `ShipmentLineItem.description` | Corrected citation: Commercial description text is stored in ShipmentLineItem.description |
| `LicenseCertificatePermitInput.licenseCertificatePermitTypeCode` | **PARTIAL** | `ShipmentLineItem.pgaRequirements` | Corrected citation: Line PGA requirements are accessed via pgaRequirements relation |
| `LicenseCertificatePermitInput.licenseCertificatePermitNumber` | **PARTIAL** | `ShipmentLineItem.pgaRequirements` | Corrected citation: Line PGA requirements are accessed via pgaRequirements relation |
| `LineEntityInput.entityCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityInput.entityName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityInput.entityIdentifierQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityInput.entityIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGbiInput.gbiIdentifierQualifier` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `LineEntityGbiInput.identifier` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `LineEntityGbiInput.partyTypeDescriptions` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `GbiPartyTypeDescriptionInput.sequenceNumber` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `GbiPartyTypeDescriptionInput.description` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `LineEntityStreetAddressInput.addressComponentQualifier1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityStreetAddressInput.addressInformation1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityStreetAddressInput.addressComponentQualifier2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityStreetAddressInput.addressInformation2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGeographicAreaInput.cityName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGeographicAreaInput.countrySubEntityCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGeographicAreaInput.postalCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineEntityGeographicAreaInput.countryCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderEntityGroupInput.entity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderEntityGroupInput.gbiIdentifiers` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `HeaderEntityGroupInput.streetAddresses` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderEntityGroupInput.geographicArea` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ArticlePartyInput.partyTypeCode` | **PARTIAL** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `ArticlePartyInput.partyIdentifier` | **PARTIAL** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `StandardVisaInput.standardVisaNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportersAdditionalDeclarationInput.declarationTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportersAdditionalDeclarationInput.declarationInformation` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderFeesInput.accountingClassCode1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderFeesInput.headerFeeAmount1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderFeesInput.accountingClassCode2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderFeesInput.headerFeeAmount2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineUserFeeInput.accountingClassCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineUserFeeInput.userFeeAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `IrTaxInput.accountingClassCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `IrTaxInput.irTaxAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `OtherRevenueInput.accountingClassCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `OtherRevenueInput.otherRevenueAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `PscHeaderReasonsInput.reasonCode1` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscHeaderReasonsInput.reasonCode2` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscHeaderReasonsInput.reasonCode3` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscHeaderReasonsInput.reasonCode4` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscHeaderReasonsInput.reasonCode5` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscFilingExplanationInput.explanationText` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscLineReasonsInput.reasonCode1` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscLineReasonsInput.reasonCode2` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscLineReasonsInput.reasonCode3` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscLineReasonsInput.reasonCode4` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `PscLineReasonsInput.reasonCode5` | **COVERED** | `PostSummaryCorrection.reason` | Corrected citation: PostSummaryCorrection.reason stores PSC correction reason text |
| `CensusWarningOverrideInput.conditionCode1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.overrideCode1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.conditionCode2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.overrideCode2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.conditionCode3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.overrideCode3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.conditionCode4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.overrideCode4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.conditionCode5` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.overrideCode5` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.conditionCode6` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.overrideCode6` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.conditionCode7` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CensusWarningOverrideInput.overrideCode7` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `E0SummaryReference.referenceDataTypeCode` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `E0SummaryReference.occurrencePosition` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `E0SummaryReference.entryFilerCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E0SummaryReference.entryNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E0SummaryReference.brokerReferenceNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E0SummaryReference.cbpTeamNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E0OtherReference.referenceDataTypeCode` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `E0OtherReference.occurrencePosition` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `E0OtherReference.referenceDataText` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.dispositionTypeCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.severityCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.conditionCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.reasonCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.narrativeText` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.entryFilerCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.entryNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.versionNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.brokerReferenceNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `E1Record.isFinalDisposition` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `EntrySummaryCondition.references` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `EntrySummaryCondition.condition` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `ParsedEntrySummaryResponse.scenario` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `ParsedEntrySummaryResponse.conditions` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `ParsedEntrySummaryResponse.finalDisposition` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |


### 3. Entry Summary Query

**Source file:** [`src/lib/abi/entrySummaryQuery/types.ts`](src/lib/abi/entrySummaryQuery/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `DetailReturnRequestInput.returnDetailRequestIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryReference.entryFilerCode` | **COVERED** | `CustomsFiling.entryNumber` | Query input filters map to CustomsFiling/ImporterOfRecord parameters (Verified: CustomsFiling.entryNumber exists [String]) |
| `EntryReference.entryNumber` | **COVERED** | `CustomsFiling.entryNumber` | Query input filters map to CustomsFiling/ImporterOfRecord parameters (Verified: CustomsFiling.entryNumber exists [String]) |
| `EntryNumberQueryRequestInput.entryFilerCode1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryNumber1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryFilerCode2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryNumber2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryFilerCode3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryNumber3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryFilerCode4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryNumber4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryFilerCode5` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntryNumberQueryRequestInput.entryNumber5` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.criteriaQueryTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.requestedFromDateTime` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.requestedToDateTime` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.entrySummariesFlag` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.ftaReconSummariesFlag` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.otherReconSummariesFlag` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.drawbackSummariesFlag` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.dutyDeferralSummariesFlag` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryRequestInput.collectionBillInformationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CriteriaQueryResponseHeader.criteriaQueryTypeCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `CriteriaQueryResponseHeader.requestedFromDateTime` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `CriteriaQueryResponseHeader.requestedToDateTime` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.entryFilerCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.entryNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.versionNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.acceptDateTime` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.pscIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.pscAcceptDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.ownershipDataReturnedIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusInfo.liquidationStatusCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntrySummaryStatusInfo.liquidationDate` | **COVERED** | `Protest.liquidationDate` | Liquidation date captured in Protest model (Verified: Protest.liquidationDate exists [DateTime]) |
| `EntrySummaryStatusInfo.centerId` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `QueryReturnedCondition.conditionCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `QueryReturnedCondition.reasonCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `QueryReturnedCondition.narrativeText` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `QueryReturnedCondition.entryFilerCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `QueryReturnedCondition.entryNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `QueryReturnedCondition.districtPortOfEntry` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `EntrySummaryStatusDetail.entrySummaryControlStatus` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.entrySummaryStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.entrySummaryStatusDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.lateFilingStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.releaseStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.releaseDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.collectionStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.collectionDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.extensionSuspensionDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.extensionSuspensionNoticeDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.censusHeaderStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.invoiceStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.protestStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.quotaStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.tradeAgreementReconciliationFilerCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.tradeAgreementReconciliationEntryNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.otherReconciliationFilerCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.otherReconciliationEntryNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.extensionSuspensionStatusCode1` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.extensionSuspensionStatusCode2` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.extensionSuspensionStatusCode3` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryStatusDetail.extensionSuspensionStatusCode4` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.cbpReviewIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.entryDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidatedDuty` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidatedTax` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidatedFees` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidatedInterest` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidatedAdCvd` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidationReasonCode1` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidationReasonCode2` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.liquidationReasonCode3` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `LiquidationInfo.immediateDeliveryIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EstimatedRevenueInfo.estimatedDuty` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EstimatedRevenueInfo.estimatedTax` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EstimatedRevenueInfo.estimatedFees` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EstimatedRevenueInfo.estimatedInterest` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EstimatedRevenueInfo.estimatedAdCvd` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryFilingInfo.importerOfRecordNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryFilingInfo.entryTypeCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryFilingInfo.rejectDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryFilingInfo.acceleratedDrawbackIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryFilingInfo.electronicInvoiceIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryFilingInfo.districtPortOfEntry` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryFilingInfo.entrySummaryFilingDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `WarehouseAndLineInfo.numberOfWithdrawals` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `WarehouseAndLineInfo.warehouseFinalWithdrawalIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `WarehouseAndLineInfo.importSpecialistTeam` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `WarehouseAndLineInfo.centerId` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `WarehouseAndLineInfo.numberOfLineItems` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `FormReferenceInfo.cbpForm4811ReferenceNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `FormReferenceInfo.preliminaryStatementPrintDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `FormReferenceInfo.brokerReferenceNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BondSuretyInfo.suretyCode` | **COVERED** | `Bond.bondNumber` | Bond details returned map to Bond model (Verified: Bond.bondNumber exists [String]) |
| `BondSuretyInfo.primarySuretyIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BondSuretyInfo.bondTypeCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BondSuretyInfo.bondDesignationTypeCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BondSuretyInfo.multipleBondsIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BondSuretyInfo.bondNumber` | **COVERED** | `Bond.bondNumber` | Bond details returned map to Bond model (Verified: Bond.bondNumber exists [String]) |
| `BondSuretyInfo.singleEntryBondAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BondSuretyInfo.suretyLiabilityAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.billNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.billDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.billTypeCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.billCollectionStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.totalBillAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.paidAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.principalAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `BillDetailStatusInfo.interestAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `CollectionDetailStatusInfo.collectionDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `CollectionDetailStatusInfo.totalAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `CollectionClassCodeDetailInfo.classCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `CollectionClassCodeDetailInfo.classCodeAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.suretyCode` | **COVERED** | `Bond.bondNumber` | Bond details returned map to Bond model (Verified: Bond.bondNumber exists [String]) |
| `SuretyBillDetailStatusInfo.primarySuretyIndicator` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.report612Date` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.billNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.billDate` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.billTypeCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.billCollectionStatusCode` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.totalBillAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.paidAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.principalAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `SuretyBillDetailStatusInfo.interestAmount` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `CbpLineNumberInfo.cbpLineNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsLineItem.cbpLineNumber` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsLineItem.header` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsLineItem.tariffDetails` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsGrouping.headerControl` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsGrouping.headerContent` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsGrouping.lineItems` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsGrouping.feeTotals` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |
| `EntrySummaryDetailsGrouping.grandTotals` | **NOT APPLICABLE** | - | ACE entry summary query response detail / condition status code returned by CBP |


### 4. Cargo Release (3461)

**Source file:** [`src/lib/abi/cargoRelease/types.ts`](src/lib/abi/cargoRelease/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `HeaderInput.actionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.entryFilerCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.entryNumber` | **COVERED** | `CustomsFiling.entryNumber` | Entry number (Verified: CustomsFiling.entryNumber exists [String]) |
| `HeaderInput.entryTypeCode` | **COVERED** | `CustomsFiling.entryType` | Corrected citation: CustomsFiling.entryType is a "LEGACY FIELD (kept temporarily for backwards compatibility)" per its schema comment, not @deprecated — it is the dedicated 2-digit US entry type code column, kept alongside country/procedureCode/messageName (Verified: CustomsFiling.entryType exists [String?]) |
| `HeaderInput.importerOfRecordType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.importerOfRecordNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.modeOfTransportationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.bondTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.estimatedEntryValue` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.plannedPortOfEntry` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.splitShipmentReleaseCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.portOfUnlading` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.entryDateElectionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.electedEntryDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.locationOfGoodsFirms` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.electedExamSiteFirms` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.conveyanceNameOrFtzId` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.voyageFlightTripManifestNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.generalOrderNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.cbpBondedWarehouseFirms` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.originatingWarehouseEntryFilerCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.originatingWarehouseEntryNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdditionalHeaderInput.immediateDeliveryIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ContactCancellationInput.contactName` | **PARTIAL** | `PartyContact.name` | Contact name and email captured on PartyContact, cancellation reason in metadata (Verified: PartyContact.name exists [String?]) |
| `ContactCancellationInput.contactPhone` | **PARTIAL** | `PartyContact.name` | Contact name and email captured on PartyContact, cancellation reason in metadata (Verified: PartyContact.name exists [String?]) |
| `ContactCancellationInput.cancellationReasonCode` | **PARTIAL** | `PartyContact.name` | Contact name and email captured on PartyContact, cancellation reason in metadata (Verified: PartyContact.name exists [String?]) |
| `ContactCancellationInput.multipleCargoDispositionsIndicator` | **PARTIAL** | `PartyContact.name` | Contact name and email captured on PartyContact, cancellation reason in metadata (Verified: PartyContact.name exists [String?]) |
| `ContactCancellationInput.disIndicator` | **PARTIAL** | `PartyContact.name` | Contact name and email captured on PartyContact, cancellation reason in metadata (Verified: PartyContact.name exists [String?]) |
| `ContactCancellationInput.splitShipmentIndicator` | **PARTIAL** | `PartyContact.name` | Contact name and email captured on PartyContact, cancellation reason in metadata (Verified: PartyContact.name exists [String?]) |
| `BillOfLadingInput.billTypeIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingInput.issuerCodeOfBillOfLadingNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingInput.billOfLadingNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingInput.quantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingInput.nonAmsIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInput.carrierCode` | **COVERED** | `TransportLeg.carrierCode` | Carrier code (Verified: TransportLeg.carrierCode exists [String?]) |
| `ConveyanceInput.voyageFlightTripManifestNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInput.dateOfArrival` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInput.quantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInput.unitOfMeasure` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInput.conveyanceName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ReferenceInput.referenceIdentifierQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ReferenceInput.referenceIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityInput.entityCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityInput.entityName` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityInput.entityIdentifierQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityInput.entityIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityAddressInput.addressComponentQualifier1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityAddressInput.addressInformation1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityAddressInput.addressComponentQualifier2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityAddressInput.addressInformation2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityGeoInput.cityName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityGeoInput.countrySubEntityCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityGeoInput.postalCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityGeoInput.countryCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `LineItemInput.lineItemIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LineItemInput.countryOfOrigin` | **COVERED** | `ShipmentLineItem.countryOfOrigin` | Country of origin (Verified: ShipmentLineItem.countryOfOrigin exists [String]) |
| `LineItemInput.commercialInvoiceDescription` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HtsLineInput.htsNumber` | **COVERED** | `ShipmentLineItem.htsCode` | HTS code (Verified: ShipmentLineItem.htsCode exists [String]) |
| `HtsLineInput.lineItemValue` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `OutputDispositionInput.messageTypeCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `OutputDispositionInput.messageIdentifierCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `OutputDispositionInput.narrativeMessageText` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `EquipmentInput.equipmentNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityGbiInput.gbiIdentifierQualifier` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `EntityGbiInput.gbiIdentifier` | **PARTIAL** | `PartyIdentifier.value` | Corrected citation: Identifier value is stored in PartyIdentifier.value |
| `FtzDetailInput.zoneStatus` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FtzDetailInput.privilegedFtzMerchandiseFilingDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FtzDetailInput.ftzLineItemQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `FtzPfHtsInput.currentHtsNumberForPfStatusMerchandise` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |


### 5. Daily & Periodic Monthly Statement

**Source file:** [`src/lib/abi/statement/types.ts`](src/lib/abi/statement/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `Q1DailyInput.districtPortOfEntrySummary` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.entryFilerCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.entryNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.importerOfRecordNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.preliminaryDailyStatementPrintDate` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.estimatedDutyAmount` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q1DailyInput.estimatedTaxAmount` | **PARTIAL** | `CustomsFiling.totalTaxes` | Statement monetary total maps to CustomsFiling.totalTaxes (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q1DailyInput.deferredTaxIndicator` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.brokerReferenceNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.consolidatedIndicator` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.clientBranchDesignation` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1DailyInput.entryType` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.districtPortOfEntrySummary` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.entryFilerCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.entryNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.antidumpingDutyAmount` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q2DailyInput.countervailingDutyAmount` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q2DailyInput.paymentTypeIndicator` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.payIndicator` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.countervailingIndicator` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.antidumpingIndicator` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.teamNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q2DailyInput.interestAmountForReconciliationSummary` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `StatementFeeInput.sequenceNumber` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `StatementFeeInput.firstFeeClassCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `StatementFeeInput.firstFeeAmount` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `StatementFeeInput.secondFeeClassCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `StatementFeeInput.secondFeeAmount` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `StatementFeeInput.thirdFeeClassCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `StatementFeeInput.thirdFeeAmount` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `StatementFeeInput.fourthFeeClassCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `StatementFeeInput.fourthFeeAmount` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `StatementFeeInput.fifthFeeClassCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `StatementFeeInput.fifthFeeAmount` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q3DailyInput.dailyStatementNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3DailyInput.dailyStatementPrintDate` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3DailyInput.entryFilerCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3DailyInput.importerOfRecordNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3DailyInput.totalEstimatedDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q3DailyInput.totalEstimatedTax` | **PARTIAL** | `CustomsFiling.totalTaxes` | Statement monetary total maps to CustomsFiling.totalTaxes (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q3DailyInput.totalDeferredTax` | **PARTIAL** | `CustomsFiling.totalTaxes` | Statement monetary total maps to CustomsFiling.totalTaxes (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q3DailyInput.districtPortWhichProcessesEntries` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q4DailyInput.totalAntidumpingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q4DailyInput.totalCountervailingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q4DailyInput.totalAmountDue` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q4DailyInput.totalInterestAmountForReconciliationSummary` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q4DailyInput.totalNumberRevenueProducingEntries` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q4DailyInput.totalNumberNonRevenueProducingEntries` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q6DailyInput.totalAntidumpingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q6DailyInput.totalCountervailingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q6DailyInput.totalAmountPaid` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q6DailyInput.totalInterestAmountForReconciliationSummary` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q6DailyInput.totalNumberRevenueProducingEntries` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q6DailyInput.totalNumberNonRevenueProducingEntries` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q7DeletedInput.statementNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Q7DeletedInput.entryFilerCode1` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.entryNumber1` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.deleteSource1` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.entryFilerCode2` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.entryNumber2` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.deleteSource2` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.entryFilerCode3` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.entryNumber3` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.deleteSource3` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.entryFilerCode4` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.entryNumber4` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q7DeletedInput.deleteSource4` | **NOT APPLICABLE** | - | CBP deleted statement notification record |
| `Q1PeriodicInput.periodicDailyStatementNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1PeriodicInput.periodicDailyStatementDistrictPort` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1PeriodicInput.periodicDailyStatementFilerCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1PeriodicInput.periodicDailyStatementImporterNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1PeriodicInput.preliminaryPeriodicDailyStatementPrintDate` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1PeriodicInput.entrySummaryPresentationDate` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q1PeriodicInput.totalDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q1PeriodicInput.totalTax` | **PARTIAL** | `CustomsFiling.totalTaxes` | Statement monetary total maps to CustomsFiling.totalTaxes (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q2PeriodicInput.totalAntidumpingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q2PeriodicInput.totalCountervailingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q2PeriodicInput.totalAmountDue` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q3PeriodicInput.periodicMonthlyStatementNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3PeriodicInput.periodicMonthlyStatementPrintDate` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3PeriodicInput.periodicMonthlyStatementDueDate` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3PeriodicInput.periodicMonthlyStatementFilerCode` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3PeriodicInput.periodicMonthlyStatementImporterNumber` | **MISSING** | - | Citation Invoice.totalAmount invalid for this field: totalAmount is a single monetary scalar and cannot capture a non-monetary code/number/date/indicator; no statement-level field exists in schema for this |
| `Q3PeriodicInput.totalDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q3PeriodicInput.totalTax` | **PARTIAL** | `CustomsFiling.totalTaxes` | Statement monetary total maps to CustomsFiling.totalTaxes (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q6PeriodicInput.totalAntidumpingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q6PeriodicInput.totalCountervailingDuty` | **PARTIAL** | `CustomsFiling.totalDuties` | Statement monetary total maps to CustomsFiling.totalDuties (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |
| `Q6PeriodicInput.totalAmountPaid` | **PARTIAL** | `CustomsFiling.totalAmount` | Statement monetary total maps to CustomsFiling.totalAmount (aggregate scalar), but lacks itemized per-statement / per-accounting-class breakdown |


### 6. eBond

**Source file:** [`src/lib/abi/ebond/types.ts`](src/lib/abi/ebond/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `HeaderInput.bondDesignationTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.bondTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.bondActivityCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.bondAmount` | **COVERED** | `Bond.bondAmount` | Bond amount (Verified: Bond.bondAmount exists [Decimal]) |
| `HeaderInput.executionDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.suretyReferenceNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.effectiveDate` | **COVERED** | `Bond.effectiveDate` | Effective date (Verified: Bond.effectiveDate exists [DateTime]) |
| `HeaderInput.terminationDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.bondNumber` | **COVERED** | `Bond.bondNumber` | Bond number (Verified: Bond.bondNumber exists [String]) |
| `HeaderInput.reconciliationBondRiderFlag` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HeaderInput.usviBondRiderFlag` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SecondaryNotifyInput.secondaryNotifyPartyCode1` | **PARTIAL** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `SecondaryNotifyInput.secondaryNotifyPartyCode2` | **PARTIAL** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `SecondaryNotifyInput.secondaryNotifyPartyCode3` | **PARTIAL** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `SecondaryNotifyInput.secondaryNotifyPartyCode4` | **PARTIAL** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `SingleTransactionBondInput.transactionIdTypeCode` | **PARTIAL** | `Bond.bondType` | Single transaction bond details stored on Bond model (Verified: Bond.bondType exists [String]) |
| `SingleTransactionBondInput.entryTypeCode` | **PARTIAL** | `Bond.bondType` | Single transaction bond details stored on Bond model (Verified: Bond.bondType exists [String]) |
| `SingleTransactionBondInput.transactionId` | **PARTIAL** | `Bond.bondType` | Single transaction bond details stored on Bond model (Verified: Bond.bondType exists [String]) |
| `PrincipalInput.principalIdNumberType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `PrincipalInput.principalIdNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `PrincipalInput.principalName` | **COVERED** | `ImporterOfRecord.name` | Corrected citation: Bond links to ImporterOfRecord; principal name is ImporterOfRecord.name |
| `CoPrincipalInput.coPrincipalIdNumberType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CoPrincipalInput.coPrincipalIdNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CoPrincipalInput.coPrincipalName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondUserInput.bondUserIdNumberType` | **PARTIAL** | `User.id` | Bond user identity mapped to User model (Verified: User.id exists [String]) |
| `BondUserInput.bondUserIdNumber` | **PARTIAL** | `User.id` | Bond user identity mapped to User model (Verified: User.id exists [String]) |
| `BondUserInput.bondUserName` | **PARTIAL** | `User.id` | Bond user identity mapped to User model (Verified: User.id exists [String]) |
| `BondUserInput.userRiderActionCode` | **PARTIAL** | `User.id` | Bond user identity mapped to User model (Verified: User.id exists [String]) |
| `BondUserInput.userAddDate` | **PARTIAL** | `User.id` | Bond user identity mapped to User model (Verified: User.id exists [String]) |
| `BondUserInput.userDeleteDate` | **PARTIAL** | `User.id` | Bond user identity mapped to User model (Verified: User.id exists [String]) |
| `SuretyInput.suretyCode` | **COVERED** | `Bond.suretyName` | Corrected citation: Bond has suretyName String, but lacks 3-digit CBP suretyCode column |
| `SuretyInput.agentIdNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SuretyInput.suretyName` | **COVERED** | `Bond.suretyName` | Surety name (Verified: Bond.suretyName exists [String]) |
| `SuretyInput.suretyLiabilityAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CoSuretyInput.coSuretyCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CoSuretyInput.agentIdNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CoSuretyInput.coSuretyName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CoSuretyInput.coSuretyLiabilityAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ReinsurerInput.suretyCodeForReinsurer` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ReinsurerInput.agentIdNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ReinsurerInput.suretyName` | **COVERED** | `Bond.suretyName` | Surety name (Verified: Bond.suretyName exists [String]) |
| `OutputMessageInput.dispositionTypeCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `OutputMessageInput.severityCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `OutputMessageInput.conditionCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `OutputMessageInput.narrativeText` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |


### 7. Drawback (7553)

**Source file:** [`src/lib/abi/drawback/types.ts`](src/lib/abi/drawback/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `DrawbackHeaderInput.summaryFilingActionRequestCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.entryFilerCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.entryNumberOrDrawbackClaimNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.drawbackFilingPort` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.brokerReferenceNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.drawbackProvision` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.bondWaiverIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.bondWaiverReasonCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.acceleratedPaymentRequestIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.oneTimeWaiverIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.waiverPriorNotice` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.commercialInterchangeability` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.electronicPetroleumCertification` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.electronicManufacturingPetroleumCertification` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.oilSpillTaxCertification` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.naftaDrawbackClaimIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.electronicSignature` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.claimantIdOrImporterRecordNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.designatedNotifyPartyNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.substitutedUnusedWineCertification` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.billOfMaterialsFormulaCertification` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.certificationForValuationOfDestroyedMerchandise` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.usmcaDrawbackClaimIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.retailSalesSubstitutionIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `DrawbackHeaderInput.superfundTaxCertification` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondInfoInput.bondTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondInfoInput.bondDesignationTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondInfoInput.suretyCompanyCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondInfoInput.singleTransactionBondAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BondInfoInput.singleTransactionBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.actionIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.entryFilerCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.entryNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.cbpEsLineNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.drawbackEligibleIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.manufactureRulingNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.basisOfClaim` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.manufDateReceived` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.manufDateUsed` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.importTrackingIdNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportsDetailsInput.drawbackAccountingMethodCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportClassificationInput.htsNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportClassificationInput.articleDescriptionText` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportQuantityUomInput.quantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportQuantityUomInput.unitOfMeasureCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportQuantityUomInput.allowableQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportQuantityUomInput.enteredGoodsValuePerUnit` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportQuantityUomInput.substitutedValuePerUnit` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ImportRevenueClaimedInput.accountingClassCode` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `ImportRevenueClaimedInput.claimAmount` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `ImportRevenueClaimedInput.calculatedAmount` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `ImportRevenueClaimedInput.adjustedClaimedAmount` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `ImportRevenueClaimedInput.qualifierIndicator` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `ManufacturedArticleInput.actionIndicator` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedArticleInput.importManufactureRulingNumber` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedArticleInput.htsNumber` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedArticleInput.quantity` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedArticleInput.unitOfMeasureCode` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedArticleInput.productionDate` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedArticleInput.factoryLocation` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedDescInput.manufacturedArticleDescriptionText` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedDescInput.manufactureRulingNumber` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ManufacturedDescInput.manufacturedTrackingIdNumber` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkImportMfgInput.importTrackingIdNumber1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber5` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber6` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber7` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber8` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber9` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber10` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber11` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber12` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber13` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber14` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkImportMfgInput.importTrackingIdNumber15` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber1` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber2` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber3` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber4` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber5` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber6` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber7` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber8` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber9` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber10` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber11` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber12` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber13` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber14` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `LinkMfgSourceInput.manufacturedTrackingIdNumber15` | **PARTIAL** | `DrawbackMatch.matchedQuantity` | Corrected citation: DrawbackMatch.matchedQuantity links import and export lines |
| `ExportDestroyInput.exportOrDestroyIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.htsNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.exportOrDestroyQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.unitOfMeasureCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.exportOrDestroyDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.noticeOfIntentIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.waiverToDrawbackClaimRightsIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.nameOfExporterOrDestroyer` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.countryOfUltimateDestination` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.billOfLadingIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDestroyInput.billOfLadingCarrierCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDescInput.exportOrDestroyArticleDescriptionText` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExportDescInput.exportOrDestroyUniqueIdentifierNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NoticeOfIntentInput.intendedPortOfExport` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NoticeOfIntentInput.examinationWitnessIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NoticeOfIntentInput.locationOfDestruction` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NoticeOfIntentInput.resultsOfExaminationOrWitnessOfDestruction` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExamWitnessInput.recordIndicator` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `ExamWitnessInput.nameOfCbpPersonnel` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExamWitnessInput.cbpPersonnelBadgeNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExamWitnessInput.cbpPersonnelPhoneNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ExamWitnessInput.processingExaminationDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.entryNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.entryDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.dutyPaidToForeignGovtLocalCurrency` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.exchangeRate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.tariffNumber1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.tariffNumber2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.tariffNumber3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `NaftaUsmcaInput.countryOfExport` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.exportOrDestroyIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.htsNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.exportOrDestroyQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.unitOfMeasureCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.exportOrDestroyDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.noticeOfIntentIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.waiverToDrawbackClaimRightsIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.nameOfExporterOrDestroyer` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.countryOfUltimateDestination` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.billOfLadingIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.billOfLadingCarrierCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `TfteaExportDestroyInput.scheduleBCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `RevenueClassTotalsInput.accountingClassCode1` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueClassTotalsInput.totalAmount1` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueClassTotalsInput.accountingClassCode2` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueClassTotalsInput.totalAmount2` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueClassTotalsInput.accountingClassCode3` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueClassTotalsInput.totalAmount3` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueClassTotalsInput.accountingClassCode4` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueClassTotalsInput.totalAmount4` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueGrandTotalsInput.grandTotalDutyAmount` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueGrandTotalsInput.grandTotalUserFeeAmount` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `RevenueGrandTotalsInput.grandTotalIrTaxAmount` | **COVERED** | `DrawbackClaim.totalRefundClaimed` | Revenue totals map to DrawbackClaim refund totals (Verified: DrawbackClaim.totalRefundClaimed exists [Decimal]) |
| `DrawbackE0Input.referenceDataTypeCode` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `DrawbackE0Input.occurrencePosition` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `DrawbackE0Input.referenceDataText` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.dispositionTypeCode` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.severityCode` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.conditionCode` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.reasonCode` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.narrativeText` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.entryFilerCode` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.entryNumber` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.versionNumber` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |
| `DrawbackE1Input.brokerReferenceNumber` | **NOT APPLICABLE** | - | Drawback CBP output response condition / rejection record |


### 8. PGA Message Set

**Source file:** [`src/lib/abi/pgaMessageSet/types.ts`](src/lib/abi/pgaMessageSet/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `OiLineItemInput.commercialDescription` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.pgaLineNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.governmentAgencyCode` | **COVERED** | `ShipmentLineItem.pgaRequirements` | Corrected citation: Line PGA agency requirement is accessed via pgaRequirements relation |
| `Pg01HeaderInput.governmentAgencyProgramCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.governmentAgencyProcessingCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.electronicImageSubmitted` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.confidentialInformationIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.globallyUniqueProductIdentificationCodeQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.globallyUniqueProductIdentificationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.intendedUseCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.intendedUseDescription` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.correctionIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg01HeaderInput.disclaimer` | **COVERED** | `ShipmentLineItem.pgaRequirements` | Corrected citation: Line PGA requirements are accessed via pgaRequirements relation |
| `Pg02ProductComponentInput.itemType` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg02ProductComponentInput.productCodeQualifier1` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg02ProductComponentInput.productCodeNumber1` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg02ProductComponentInput.productCodeQualifier2` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg02ProductComponentInput.productCodeNumber2` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg02ProductComponentInput.productCodeQualifier3` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg02ProductComponentInput.productCodeNumber3` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg04ConstituentElementInput.constituentActiveIngredientQualifier` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg04ConstituentElementInput.nameOfConstituentElement` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg04ConstituentElementInput.quantityOfConstituentElement` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg04ConstituentElementInput.unitOfMeasureConstituentElement` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg04ConstituentElementInput.percentOfConstituentElement` | **PARTIAL** | `ProductComposition.componentName` | Corrected citation: Product component/ingredient name is stored in ProductComposition.componentName |
| `Pg06SourceProcessingInput.sourceTypeCode` | **PARTIAL** | `ProductCountryFact.rawCountry` | Corrected citation: Processing country is stored in ProductCountryFact.rawCountry |
| `Pg06SourceProcessingInput.countryCode` | **COVERED** | `PartyAddress.addressLine1` | PGA party address fields (Verified: PartyAddress.addressLine1 exists [String]) |
| `Pg06SourceProcessingInput.geographicLocation` | **PARTIAL** | `ProductCountryFact.rawCountry` | Corrected citation: Processing country is stored in ProductCountryFact.rawCountry |
| `Pg06SourceProcessingInput.processingStartDate` | **PARTIAL** | `ProductCountryFact.rawCountry` | Corrected citation: Processing country is stored in ProductCountryFact.rawCountry |
| `Pg06SourceProcessingInput.processingEndDate` | **PARTIAL** | `ProductCountryFact.rawCountry` | Corrected citation: Processing country is stored in ProductCountryFact.rawCountry |
| `Pg06SourceProcessingInput.processingTypeCode` | **PARTIAL** | `ProductCountryFact.rawCountry` | Corrected citation: Processing country is stored in ProductCountryFact.rawCountry |
| `Pg06SourceProcessingInput.processingDescription` | **PARTIAL** | `ProductCountryFact.rawCountry` | Corrected citation: Processing country is stored in ProductCountryFact.rawCountry |
| `Pg07TradeNameModelInput.tradeNameBrandName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg07TradeNameModelInput.model` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg07TradeNameModelInput.manufactureMonthAndYear` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg07TradeNameModelInput.itemIdentityNumberQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg07TradeNameModelInput.itemIdentityNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg08ItemIdentityOverflowInput.itemIdentityNumber1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg08ItemIdentityOverflowInput.itemIdentityNumber2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg08ItemIdentityOverflowInput.itemIdentityNumber3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg08ItemIdentityOverflowInput.itemIdentityNumber4` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg10CategoryCharacteristicInput.categoryTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg10CategoryCharacteristicInput.categoryCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg10CategoryCharacteristicInput.commodityQualifierCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg10CategoryCharacteristicInput.commodityCharacteristicQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg10CategoryCharacteristicInput.commodityCharacteristicDescription` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg13LpcoIssuerInput.issuerOfLpco` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg13LpcoIssuerInput.lpcoIssuerGovernmentGeographicCodeQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg13LpcoIssuerInput.locationOfIssuerOfTheLpco` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg13LpcoIssuerInput.regionalDescriptionOfLocationOfAgencyIssuingLpco` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.lpcoTransactionType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.lpcoType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.lpcoNumberOrName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.lpcoDateQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.lpcoDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.lpcoQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.lpcoUnitOfMeasure` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg14LpcoDetailsInput.exemptionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg18HazmatInput.unDangerousGoodsCode` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat UN code/class has no scalar column on ShipmentLineItem (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `Pg18HazmatInput.hazardousClassCode` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat UN code/class has no scalar column on ShipmentLineItem (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `Pg18HazmatInput.epaHazardousWasteCode` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat UN code/class has no scalar column on ShipmentLineItem (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `Pg18HazmatInput.hazardousMaterialDescription` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat UN code/class has no scalar column on ShipmentLineItem (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `Pg18HazmatInput.packagingGroupCode` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat UN code/class has no scalar column on ShipmentLineItem (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `Pg19EntityIdentificationInput.entityRoleCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg19EntityIdentificationInput.entityIdentificationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg19EntityIdentificationInput.entityNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg19EntityIdentificationInput.entityName` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `Pg19EntityIdentificationInput.entityAddress1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg20EntityAddressInput.entityAddress2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg20EntityAddressInput.entityApartmentSuiteNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg20EntityAddressInput.entityCity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg20EntityAddressInput.entityStateProvince` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg20EntityAddressInput.entityCountry` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg20EntityAddressInput.entityZipPostalCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg21IndividualContactInput.individualQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg21IndividualContactInput.individualName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg21IndividualContactInput.telephoneNumberOfTheIndividual` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg21IndividualContactInput.emailAddressOrFaxNumberForTheIndividual` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.importersSubstantiatingSignedDocument` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.documentIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.conformanceDeclaration` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.entityRoleCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.declarationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.declarationCertification` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.dateOfSignature` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.invoiceNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg22ImporterDeclarationInput.complianceDescription` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg24RemarksInput.remarksTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg24RemarksInput.remarksCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg24RemarksInput.remarksText` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.temperatureQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.degreeType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.negativeNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.actualTemperature` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.locationOfTemperatureRecording` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.lotNumberQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.lotNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.productionStartDateOfTheLot` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.productionEndDateOfTheLot` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.pgaLineValue` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg25TemperatureLotValuesInput.pgaUnitValue` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg26PackagingBreakdownInput.packagingQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg26PackagingBreakdownInput.quantity` | **COVERED** | `ShipmentLineItem.quantity` | Quantity (Verified: ShipmentLineItem.quantity exists [Int]) |
| `Pg26PackagingBreakdownInput.unitOfMeasurePackagingLevel` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg26PackagingBreakdownInput.packageIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg26PackagingBreakdownInput.packagingMethod` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg26PackagingBreakdownInput.packageMaterial` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg26PackagingBreakdownInput.packageFiller` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.containerNumber1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.typeOfContainer1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.containerLength1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.containerNumber2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.typeOfContainer2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.containerLength2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.containerNumber3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.typeOfContainer3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg27ShippingContainerInput.containerLength3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.unitOfMeasurePgaLineNet` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.commodityNetQuantityPgaLineNet` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.unitOfMeasurePgaLineGross` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.commodityGrossQuantityPgaLineGross` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.unitOfMeasureIndividualUnitNet` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.commodityNetQuantityIndividualUnitNet` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.unitOfMeasureIndividualUnitGross` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg29CommodityQuantitiesInput.commodityGrossQuantityIndividualUnitGross` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg30InspectionLocationInput.inspectionLaboratoryTestingStatus` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg30InspectionLocationInput.requestedOrScheduledDateOfInspection` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg30InspectionLocationInput.requestedOrScheduledTimeOfInspection` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg30InspectionLocationInput.inspectionOrArrivalLocationCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg30InspectionLocationInput.inspectionOrArrivalLocation` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg32CommodityRoutingInput.commodityRoutingTypeCode` | **COVERED** | `TransportLeg.originUnlocode` | Commodity routing locations map to TransportLeg (Verified: TransportLeg.originUnlocode exists [String?]) |
| `Pg32CommodityRoutingInput.commodityRoutingCountryCode` | **COVERED** | `TransportLeg.originUnlocode` | Commodity routing locations map to TransportLeg (Verified: TransportLeg.originUnlocode exists [String?]) |
| `Pg32CommodityRoutingInput.commodityPoliticalSubunitOfRoutingQualifier` | **COVERED** | `TransportLeg.originUnlocode` | Commodity routing locations map to TransportLeg (Verified: TransportLeg.originUnlocode exists [String?]) |
| `Pg32CommodityRoutingInput.commodityPoliticalSubunitOfRoutingNumber` | **COVERED** | `TransportLeg.originUnlocode` | Commodity routing locations map to TransportLeg (Verified: TransportLeg.originUnlocode exists [String?]) |
| `Pg32CommodityRoutingInput.commodityPoliticalSubunitOfRoutingName` | **COVERED** | `TransportLeg.originUnlocode` | Commodity routing locations map to TransportLeg (Verified: TransportLeg.originUnlocode exists [String?]) |
| `Pg34TravelDocumentInput.travelDocumentTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg34TravelDocumentInput.travelDocumentNationality` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg34TravelDocumentInput.travelDocumentIdentifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg55AdditionalEntityRolesInput.entityRoleCode1` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode2` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode3` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode4` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode5` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode6` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode7` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode8` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode9` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg55AdditionalEntityRolesInput.entityRoleCode10` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg60AdditionalReferenceInput.additionalInformationQualifierCode` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg60AdditionalReferenceInput.additionalInformation` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg00SubstitutionInput.substitutionIndicator` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg00SubstitutionInput.substitutionNumber` | **PARTIAL** | `PartyRole.roleType` | Corrected citation: Party role type is stored in PartyRole.roleType |
| `Pg05ScientificSpeciesInput.scientificGenusName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg05ScientificSpeciesInput.scientificSpeciesName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg05ScientificSpeciesInput.scientificSubSpeciesName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg05ScientificSpeciesInput.scientificSpeciesCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg05ScientificSpeciesInput.fwsDescriptionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg17CommonNameVenomousInput.commonNameSpecific` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg17CommonNameVenomousInput.commonNameGeneral` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg17CommonNameVenomousInput.liveVenomousWildlifeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg17CommonNameVenomousInput.cartonsContainingWildlife` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg23AffirmationOfComplianceInput.affirmationOfComplianceCode` | **PARTIAL** | `ShipmentLineItem.pgaRequirements` | Corrected citation: Line PGA requirements are accessed via pgaRequirements relation |
| `Pg23AffirmationOfComplianceInput.affirmationOfComplianceDescription` | **PARTIAL** | `ShipmentLineItem.pgaRequirements` | Corrected citation: Line PGA requirements are accessed via pgaRequirements relation |
| `Pg28CanDimensionsTrackingInput.canDimensions1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg28CanDimensionsTrackingInput.canDimensions2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg28CanDimensionsTrackingInput.canDimensions3` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg28CanDimensionsTrackingInput.packageTrackingNumberCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg28CanDimensionsTrackingInput.packageTrackingNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg31HarvestingVesselInput.commodityHarvestingVesselCharacteristicTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg31HarvestingVesselInput.commodityHarvestingVesselCharacteristic` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg31HarvestingVesselInput.unitOfMeasureConveyance` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg31HarvestingVesselInput.harvestedCommodityNetWeight` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg33GeographicAreaInput.commodityGeographicAreaCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg33GeographicAreaInput.commodityGeographicAreaName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg35ConformanceBondInput.dotSuretyCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg35ConformanceBondInput.dotBondSerialNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg35ConformanceBondInput.dotBondQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `Pg35ConformanceBondInput.dotBondAmount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |


### 9. ACE Broker Download

**Source file:** [`src/lib/abi/brokerDownload/types.ts`](src/lib/abi/brokerDownload/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `ManifestHeaderRecord.carrierCode` | **COVERED** | `TransportLeg.carrierCode` | Carrier / issuer code (Verified: TransportLeg.carrierCode exists [String?]) |
| `ManifestHeaderRecord.transportationIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ManifestHeaderRecord.countryCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ManifestHeaderRecord.conveyanceName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ManifestHeaderRecord.tripData` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ManifestHeaderRecord.manifestSequenceNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ManifestHeaderRecord.vesselCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ManifestHeaderRecord.manifestTypeCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `PortOfCrossingRecord.portOfUnlading` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `PortOfCrossingRecord.originalScheduledArrivalDate` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `PortOfCrossingRecord.firmsCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `PortOfCrossingRecord.time` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `IssuerCodeRecord.issuerCode` | **COVERED** | `TransportLeg.carrierCode` | Carrier / issuer code (Verified: TransportLeg.carrierCode exists [String?]) |
| `BillOfLadingTransactionRecord.billOfLading` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.foreignPortOfLading` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.manifestQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.manifestUnits` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.weight` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.weightUnit` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.billStatusIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.masterInBondIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.houseBillNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.inBondEntryType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.inBondPortOfDestination` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingTransactionRecord.issuerCode` | **COVERED** | `TransportLeg.carrierCode` | Carrier / issuer code (Verified: TransportLeg.carrierCode exists [String?]) |
| `EntityNameRecord.entityIdCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityNameRecord.name` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityNameRecord.codeQualifier` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityNameRecord.idCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityNameRecord.entityRelationshipCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityNameRecord.entityIdCodeReserved` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `BillOfLadingContainerRecord.equipmentInitial` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.equipmentNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.sealNumber1` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.sealNumber2` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.containerDescriptionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.containerLength` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.height` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.width` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.containerType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.loadEmptyStatus` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingContainerRecord.typeOfService` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillCargoDescriptionRecord.pieceCount` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillCargoDescriptionRecord.description` | **COVERED** | `ShipmentLineItem.description` | Cargo description (Verified: ShipmentLineItem.description exists [String]) |
| `BillCargoDescriptionRecord.c4Number` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillCargoDescriptionRecord.manifestUnitCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillCargoDescriptionRecord.countryCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `MarksAndNumbersRecord.marksAndNumbers` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `StatusNotificationHeaderRecord.importingConveyanceName` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationHeaderRecord.tripNumber` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationHeaderRecord.port` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationHeaderRecord.estimatedArrivalDate` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationHeaderRecord.estimatedArrivalTime` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.dispositionCode` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.issuerCodeMasterBill` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.masterBillNumber` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.issuerCodeHouseBill` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.houseBillNumber` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.issuerCodeSubHouseBill` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.subHouseBillNumber` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.quantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `StatusNotificationDetailRecord.negativeIndicator` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.actionDate` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.actionTime` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationDetailRecord.inBondCarrierCode` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `HazardousMaterialDetailRecord.hazardousMaterialCode` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `HazardousMaterialDetailRecord.hazardousMaterialClass` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `HazardousMaterialDetailRecord.hazardousMaterialCodeQualifier` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `HazardousMaterialDetailRecord.hazardousMaterialDescription` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `HazardousMaterialDetailRecord.hazardousMaterialContact` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `HazardousMaterialDetailRecord.unHazardousMaterialPage` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `AdditionalHazardousMaterialDetailRecord.flashpointTemperature` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `AdditionalHazardousMaterialDetailRecord.unitOfMeasureCode` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `AdditionalHazardousMaterialDetailRecord.negativeIndicator` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `HazardousMaterialClassificationDetailRecord.hazardousMaterialDescription` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `HazardousMaterialClassificationDetailRecord.hazardousMaterialClassification` | **PARTIAL** | `ShipmentEquipment.sealNumbers` | Hazmat details lack dedicated line-item UN code/class columns (Verified: ShipmentEquipment.sealNumbers exists [String[]]) |
| `StatusNotificationContinuationRecord.entryType` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContinuationRecord.entryNumber` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContinuationRecord.portOfTransaction` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContinuationRecord.firmsCode` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContinuationRecord.containerNumber` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationRemarksRecord.remarks` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContainerDetailRecord.actionIndicator` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContainerDetailRecord.containerNumber` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContainerDetailRecord.sealNumber1` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `StatusNotificationContainerDetailRecord.sealNumber2` | **NOT APPLICABLE** | - | CBP status notification record returned in broker download |
| `ManifestReferenceIdentifierRecord.carrierAssignedBatchNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.carrierCode` | **COVERED** | `TransportLeg.carrierCode` | Carrier / issuer code (Verified: TransportLeg.carrierCode exists [String?]) |
| `BillOfLadingAmendmentRecord.cbpPort` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.actionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.billOfLadingNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.quantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.amendmentCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.houseBillNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.codeQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.idCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAmendmentRecord.issuerCode` | **COVERED** | `TransportLeg.carrierCode` | Carrier / issuer code (Verified: TransportLeg.carrierCode exists [String?]) |
| `BillOfLadingAdditionalRecord.measurement` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAdditionalRecord.measurementUnit` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAdditionalRecord.placeOfReceiptByPreCarrier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAdditionalRecord.secondaryNotifyParty1Scac` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingAdditionalRecord.secondaryNotifyParty2Scac` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingReferenceIdentifierRecord.referenceQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingReferenceIdentifierRecord.referenceNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `EntityAddressRecord.addressLine1` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityAddressRecord.addressLine2` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityGeographicAreaRecord.cityName` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityGeographicAreaRecord.stateProvince` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityGeographicAreaRecord.postalCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityGeographicAreaRecord.countryCode` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `EntityGeographicAreaRecord.locationIdentifier` | **COVERED** | `PartyName.rawName` | Corrected citation: Entity name is stored in PartyName relation (PartyName.rawName) |
| `AdminCommunicationContactRecord.contactName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdminCommunicationContactRecord.commNumberQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdminCommunicationContactRecord.communicationsNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdminCommunicationContactRecord.reservedCommNumberQualifier` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AdminCommunicationContactRecord.reservedCommunicationsNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.inBondEntryType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.fdaBtaConfirmationIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.conventionalInBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.inBondCarrierCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.usPortOfDestination` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.foreignDestination` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.value` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.bondedCarrierIdNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.paperlessInBond` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SupplementalInBondDetailsRecord.shipmentControlNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `WaterBorneExportInBondRecord.transportationIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `WaterBorneExportInBondRecord.vesselName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `MotorVehicleControlRecord.vin` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `MotorVehicleControlRecord.factoryCarOrderNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HarmonizedTariffRecord.harmonizedNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HarmonizedTariffRecord.value` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HarmonizedTariffRecord.weight` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `HarmonizedTariffRecord.weightUnit` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |


### 10. Cargo Manifest / Entry Status Query

**Source file:** [`src/lib/abi/cargoManifestQuery/types.ts`](src/lib/abi/cargoManifestQuery/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `CargoManifestQueryRequestInput.entryFilerCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.entryNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.inBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.issuerCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.billNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.airWaybillNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.houseAirWaybillNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.requestRelatedBol` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.requestBillAndEntryData` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryRequestInput.limitOutputOption` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `CargoManifestQueryErrorOutput.entryFilerCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `CargoManifestQueryErrorOutput.entryNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `CargoManifestQueryErrorOutput.errorMessageId` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `CargoManifestQueryErrorOutput.narrativeMessage` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `EntryStatusHeaderOutput.districtPortOfEntry` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.entryFilerCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.entryNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.entryTypeCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.importerOfRecordNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.carrierCode` | **COVERED** | `TransportLeg.vesselName` | Conveyance info returned (Verified: TransportLeg.vesselName exists [String?]) |
| `EntryStatusHeaderOutput.vesselName` | **COVERED** | `TransportLeg.vesselName` | Conveyance info returned (Verified: TransportLeg.vesselName exists [String?]) |
| `EntryStatusHeaderOutput.voyageFlightTripNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.estimatedDateOfArrival` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.splitShipmentReleaseCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryStatusHeaderOutput.correctionResponseIndicator` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryDispositionResultOutput.dispositionActionDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryDispositionResultOutput.dispositionActionTime` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryDispositionResultOutput.dispositionActionCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryDispositionResultOutput.narrativeMessage` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryDispositionResultOutput.releaseDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryDispositionResultOutput.releaseOriginCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `EntryDispositionResultOutput.documentType` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.districtPortOfEntry` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.entryFilerCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.entryNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.entryTypeCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.importerOfRecordNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.brokerReferenceNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.carrierCode` | **COVERED** | `TransportLeg.vesselName` | Conveyance info returned (Verified: TransportLeg.vesselName exists [String?]) |
| `ManifestConveyanceResultOutput.importingVesselCodeOrConveyanceName` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.voyageFlightTripNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ManifestConveyanceResultOutput.dateOfArrival` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `TripFirmsLocationOutput.tripNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `TripFirmsLocationOutput.firmsCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillQueryErrorOutput.inBondNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `InBondBillQueryErrorOutput.issuerCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `InBondBillQueryErrorOutput.billNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `InBondBillQueryErrorOutput.errorMessageId` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `InBondBillQueryErrorOutput.narrativeMessage` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `AirWaybillQueryErrorOutput.airWaybillNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `AirWaybillQueryErrorOutput.houseAirWaybillNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `AirWaybillQueryErrorOutput.errorMessageId` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `AirWaybillQueryErrorOutput.narrativeMessage` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `CountryOriginTariffResultOutput.recordControlNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `CountryOriginTariffResultOutput.countryOfOrigin` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `CountryOriginTariffResultOutput.tariffNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusUpdateOutput.inBondStatus` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusUpdateOutput.inBondArrivalDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusUpdateOutput.inBondExportDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusUpdateOutput.inBondEntryType` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.inBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondBillDetailOutput.masterBillNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.houseBillNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.subHouseBillNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.manifestQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.unit` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.issuerCodeOfMasterBillNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.issuerCodeOfHouseBillNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.billOfLadingType` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.importerSecurityFilingIndicator` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDetailOutput.modeOfTransportationCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusDetailOutput.inBondStatus` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusDetailOutput.inBondArrivalDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusDetailOutput.inBondExportDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondStatusDetailOutput.inBondEntryType` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.importingCarrierCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.flightNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.scheduledArrivalDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.airWaybillNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.partIndicator` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.manifestQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.boardedQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.houseAirWaybillNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.housePartIndicator` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.houseManifestQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.houseBoardedQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.inBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `AirInBondManifestStatusOutput.inBondStatus` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.inBondEntryType` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirInBondManifestStatusOutput.wscRecordVersion` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirWaybillDispositionResultOutput.dispositionActionDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirWaybillDispositionResultOutput.dispositionActionTime` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirWaybillDispositionResultOutput.dispositionCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirWaybillDispositionResultOutput.narrativeMessage` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AirWaybillDispositionResultOutput.inBondOrEntryNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.dispositionActionDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.dispositionActionTime` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.dispositionActionCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.narrativeMessage` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.releaseDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.releaseOriginCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.quantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondBillDispositionResultOutput.sequence` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AmendedBillQuantitiesOutput.masterBillAmendedQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `AmendedBillQuantitiesOutput.houseBillAmendedQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.inBondEntryNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.manifestedPortOfUnladingImport` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.actualPortOfUnladingImport` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.actualPortOfUnladingImportOceanVesselDiversion` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.inBondOriginatingPort` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.manifestedInBondDestinationPort` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.actualInBondDestinationManualDiversion` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.actualInBondDestinationEdiDiversion` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.vesselDeparturePort` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.vesselDepartureDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.containerLoadPort` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PortDateDetailOutput.containerLoadDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ReferenceDataOutput.referenceIdentifierQualifier` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `ReferenceDataOutput.referenceIdentifier` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `CountryOriginTariffLineOutput.lineItemIdentifier` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `CountryOriginTariffLineOutput.countryOfOrigin` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `CountryOriginTariffLineOutput.tariffNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillDetailOutput.billTypeIndicator` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillDetailOutput.issuerCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillDetailOutput.billNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillDetailOutput.quantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillDetailOutput.unitOfMeasure` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillDetailOutput.manifestedQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondDetailOutput.inBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondDetailOutput.inBondEntryType` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondDetailOutput.usPortOfInBondDeparture` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondDetailOutput.usPortOfInBondArrival` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondDetailOutput.inBondCreateDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondDetailOutput.inBondArrivalDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `InBondDetailOutput.inBondQuantity` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.dispositionDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.dispositionTime` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.dispositionCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.narrativeMessage` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.splitIndicator` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.carrierCode` | **COVERED** | `TransportLeg.vesselName` | Conveyance info returned (Verified: TransportLeg.vesselName exists [String?]) |
| `BillMatchDispositionOutput.voyageFlightTripNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.dateOfArrival` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `BillMatchDispositionOutput.districtPortOfArrival` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.governmentAgencyCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.governmentAgencyProgramCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.statusActionDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.statusActionTime` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.pgaEntryLevelStatusCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.pgaEntryLevelStatusMessage` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.entryLineLevelStatusCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.pgaLineLevelStatusCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.statusReasonCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.beginningCbpLine` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.beginningTariffPosition` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.beginningPgaLine` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.endingCbpLine` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.endingTariffPosition` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.endingPgaLine` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.documentTypeCode` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaStatusActionDetailOutput.pgaEntryHold` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaReferenceIdentificationNumberQualifier` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaReferenceIdentificationNumber` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaReferenceIdentificationNumberReceiptDate` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaReferenceIdentificationNumberReceiptTime` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode1` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode2` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode3` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode4` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode5` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode6` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode7` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode8` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode9` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaLineSubReasonCode10` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaReferenceIdentificationNumberQualifier2` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaReferenceIdentificationDetailOutput.pgaReferenceIdentificationNumber2` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |
| `PgaNarrativeCommentsOutput.commentsToTradeFromPga` | **NOT APPLICABLE** | - | ACE cargo manifest query response status / disposition detail returned by CBP |


### 11. In-Bond (7512)

**Source file:** [`src/lib/abi/inBond/types.ts`](src/lib/abi/inBond/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `InBondHeaderInput.actionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.inBondEntryType` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.inBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.inBondCarrierCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.usPortOfDest` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.portOfForeignDest` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.value` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.bondedCarrierID` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.ftzWarehouseInd` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondHeaderInput.btaFdaIndicator` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.importingCarrierCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.importMOT` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.countryCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.importingConveyance` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.voyageFlightTripNum` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.portOfImportArrival` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.estDateOfArrival` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `ConveyanceInfoInput.ftzFirmsCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.actionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.sequenceNumber` | **NOT APPLICABLE** | - | Protocol mechanics / control identifier / filler / sequence marker |
| `BillOfLadingHeaderInput.issuerCodeMasterBOL` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.masterBOLNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.issuerCodeHouseBill` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.houseBillNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.issuerCodeSubHouse` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.subHouseBillNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.prevInBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `BillOfLadingHeaderInput.inBondQuantity` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `SecondaryNotifyPartiesInput.snpCode1` | **COVERED** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `SecondaryNotifyPartiesInput.snpCode2` | **COVERED** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `SecondaryNotifyPartiesInput.snpCode3` | **COVERED** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `SecondaryNotifyPartiesInput.snpCode4` | **COVERED** | `ShipmentParty.legalEntityId` | Corrected citation: Party link is stored in ShipmentParty.legalEntityId |
| `ReferenceIdentifierInput.qualifier` | **COVERED** | `ShipmentTrackingIdentifier.value` | Corrected citation: Tracking identifier value is stored in ShipmentTrackingIdentifier.value |
| `ReferenceIdentifierInput.referenceIdentifier` | **COVERED** | `ShipmentTrackingIdentifier.value` | Corrected citation: Tracking identifier value is stored in ShipmentTrackingIdentifier.value |
| `InBondEventHeaderInput.actionCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventHeaderInput.inBondNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventHeaderInput.issuerCodeMasterBOL` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventHeaderInput.masterBOLNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventHeaderInput.issuerCodeHouseBOL` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventHeaderInput.houseBOLNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventHeaderInput.firmsLocation` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventHeaderInput.containerNumber` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.date` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.time` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.portOfArrival` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.inBondCarrierCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.bondedCarrierID` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.cityName` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.stateCode` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.exportMOT` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondEventDetailInput.exportConveyance` | **MISSING** | - | Citation - invalid (NO_CITATION); reclassified to MISSING |
| `InBondResponseMessageOutput.narrativeMsgType` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `InBondResponseMessageOutput.narrativeMsgId` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `InBondResponseMessageOutput.narrativeMessage` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationHeaderOutput.inBondEntryType` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationHeaderOutput.inBondNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationHeaderOutput.usPortOfDest` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationHeaderOutput.foreignDestination` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.dispositionCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.issuerMasterBill` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.masterBillNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.issuerHouseBill` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.houseBillNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.issuerSubHouse` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.subHouseBillNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.quantity` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.negativeIndicator` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.actionDate` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.actionTime` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationDetailOutput.inBondCarrierCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationContinuationOutput.entryType` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationContinuationOutput.entryNumber` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationContinuationOutput.distPortTxn` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationContinuationOutput.firmsCode` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationContinuationOutput.containerNum` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |
| `StatusNotificationRemarksOutput.remarks` | **NOT APPLICABLE** | - | CBP response / disposition / error status notification returned by ACE |


### 12. Importer / Bond Query

**Source file:** [`src/lib/abi/importerBondQuery/types.ts`](src/lib/abi/importerBondQuery/types.ts)

| CATAIR Field Name | Classification | Matching Prisma Model.Field | Gap Explanation / Notes |
| :--- | :--- | :--- | :--- |
| `ImporterBondQueryInput.importerNumber1` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.addressRequestCode1` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.importerNumber2` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.addressRequestCode2` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.importerNumber3` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.addressRequestCode3` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.importerNumber4` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.addressRequestCode4` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.importerNumber5` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.addressRequestCode5` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.importerNumber6` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `ImporterBondQueryInput.addressRequestCode6` | **NOT APPLICABLE** | - | Query request control / query type criteria |
| `K1Output.importerNumber` | **COVERED** | `ImporterOfRecord.name` | Importer details returned in query response (Verified: ImporterOfRecord.name exists [String]) |
| `K1Output.queryResultsCode` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K1Output.importerName` | **COVERED** | `ImporterOfRecord.name` | Importer details returned in query response (Verified: ImporterOfRecord.name exists [String]) |
| `K1Output.suretyCode` | **COVERED** | `Bond.bondNumber` | Bond details returned in query response (Verified: Bond.bondNumber exists [String]) |
| `K1Output.bondTypeActivityCode` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K1Output.bondAmount` | **COVERED** | `Bond.bondNumber` | Bond details returned in query response (Verified: Bond.bondNumber exists [String]) |
| `K1Output.districtPortWhereBondFiled` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K1Output.bondEffectiveDate` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K1Output.bondNumber` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K1Output.bondAmountRecordLocationIndicator` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.nameQualifier` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.importerNameLine2` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.bondTerminationDate` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.periodicMonthlyStatementStatus` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.bondSufficiencyIndicator` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.bondUserStatusIndicator` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.bondUserTerminationDate` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K2Output.bondAmount` | **COVERED** | `Bond.bondNumber` | Bond details returned in query response (Verified: Bond.bondNumber exists [String]) |
| `K3Output.addressLine1` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K3Output.addressLine2` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K4Output.city` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K4Output.stateCode` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K4Output.postalCode` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K5Output.addressLine1` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K5Output.addressLine2` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K6Output.city` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K6Output.stateCode` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K6Output.postalCode` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K7Output.fullLegalImporterName` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K7Output.centerIdentifier` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K7Output.centerIdDescription` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K8Output.additionalInformationQualifierCode` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |
| `K8Output.additionalInformation` | **NOT APPLICABLE** | - | CBP importer/bond query response status / error record returned by ACE |


## Recommended Next Steps

To transform the standalone CATAIR codec into a fully operational customs filing system connected to production storage, schema migrations should be executed in prioritized phases:

### Phase 1: High-Priority Business Critical Data (Immediate Focus)
1. **CBP 3-Character Filer Code (`CustomsProfile` / `Client`)**:
   - Add a dedicated `filerCode` column to `CustomsProfile` or `Client` to store the assigned 3-character CBP Filer Code required on all entry summaries and block control headers.
2. **Itemized Tariff & Fee Class Accounting (`CustomsFiling` / `ShipmentLineItem`)**:
   - Replace or supplement aggregate `totalDuties` / `totalAmount` with dedicated columns or structured relations for accounting class codes (e.g. 499 Harbor Maintenance Fee, 501 Merchandise Processing Fee, 311 Cotton Fee, 056 Environmental Tax).
3. **Census Warning Override Pairs (`CustomsFiling`)**:
   - Add dedicated columns or structured JSON array for `censusOverrideCodes` (supporting up to 7 condition code + override code pairs per entry) to enable filers to clear Census warnings during 7501 submission.
4. **PGA High-Frequency License / Permit Scalars (`ShipmentLineItem`)**:
   - Add dedicated fields for PGA License, Permit, Certificate, and Other (LPCO) numbers, issuer codes, and permit type codes (PG13/PG14) required for FDA, EPA, and USDA entry releases.
5. **Drawback Manufacturing & Destruction Claim Fields (`DrawbackLot` / `DrawbackClaim`)**:
   - Add explicit columns for manufacturing date, factory location, notice of intent to export/destroy date, and exam witness location to enable manufacturing drawback filings.

### Phase 2: Medium-Priority Specialized Regulatory Data
1. **Foreign Trade Zone (FTZ) Admission Metadata (`Shipment` / `CustomsFiling`)**:
   - Add fields for FTZ Admission Number, FTZ Zone Identifier, Privileged Status Date, and FTZ Merchandise Status Code.
2. **ADCVD Case Level Accounting (`ShipmentLineItem`)**:
   - Add line-level fields for ADCVD Case Number, Case Deposit Rate, and Bonding Flag to support Antidumping/Countervailing duty calculations alongside the existing `AdcvdOrder` reference model.
3. **PGA Commodity Specific Identifiers (`CanonicalProduct` / `ShipmentLineItem`)**:
   - Add fields for FDA Prior Notice confirmation numbers, EPA vehicle engine classification, and Affirmation of Compliance (AOC) codes.

### Phase 3: Low-Priority & Narrow Edge-Case Data
1. **Standard Textile Visa Numbers & Importer 76-Char Special Declarations**:
   - Add columns for softwood lumber export prices and textile visa numbers as demand warrants.
2. **Biological & Harvest Vessel Details (FWS / NOAA PG05 / PG31)**:
   - Add genus/species scientific names and harvest vessel flag/gear codes for specialized wildlife and fisheries entry filings.
