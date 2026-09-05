import { db } from "@/lib/db";
import { ShipmentEventBus } from "@/modules/events/shipmentEventBus";
import { isPlaceholderValue, lineItemFactField } from "./lineItemReconciler";
import { recomputeShipmentDeadlines } from "@/modules/deadlines/deadline.service";
import { createExceptionItem } from "@/lib/exceptions/createException";
import { ShipmentPartyService } from "./shipmentPartyService";
import { matchPartMaster } from "@/modules/product/partMasterMatch";
import { reconciliationKeyFor } from "@/lib/documents/fieldDictionary";

import { runReconciliationEngine, applyNorm, type DocumentGroup } from "@/lib/reconciliation/reconciliationEngine";
import { detectPlanChanges, type PlanFieldReading } from "@/lib/reconciliation/planChangeDetector";

// OCR_AI_AGENT rows carry a freeform LLM label while DOC_INTEL_STRUCTURED rows
// already use the reconciliation vocabulary; resolve the former through the
// dictionary so it can participate too when recognizable, falling back to the
// raw name (today's behavior) when it can't be resolved.
export function toReconciliationFieldName(rawFieldName: string): string {
  return reconciliationKeyFor(rawFieldName) ?? rawFieldName;
}

/**
 * True when a document's own stated gross weight is lower than its own net
 * weight -- an internal inconsistency, since gross must always be >= net.
 * Returns null when either value can't be parsed as a weight (nothing to
 * compare, not a pass).
 */
export function isGrossWeightBelowNetWeight(grossRaw: string, netRaw: string): boolean | null {
  const grossKg = applyNorm(grossRaw, "weight_unit");
  const netKg = applyNorm(netRaw, "weight_unit");
  if (grossKg === null || netKg === null) return null;
  return Number(grossKg) < Number(netKg);
}

export interface SealNumberFact {
  documentId: string | null;
  /** Fact.id, used only to key claims that carry no documentId. */
  id: string;
  /** Comma-joined seal numbers, as recorded by ContainerReconciler.recordFacts. */
  value: string;
}

export interface ContainerSealMismatch {
  normalizedContainerNumber: string;
  /** One entry per distinct document, latest claim only. */
  claims: SealNumberFact[];
}

/**
 * Finds containers whose seal numbers disagree across documents. Fact rows
 * are the source: ContainerReconciler only ever fills a currently-empty
 * ShipmentContainer field (see containerPackageReconciler.ts), so a second
 * document's conflicting seal numbers for the same container never reach the
 * curated record and would otherwise go unnoticed.
 *
 * `facts` should already be every `container.<num>.sealNumbers` Fact for the
 * shipment, newest first (so the first claim seen per document is its latest).
 */
export function findContainerSealMismatches(
  facts: readonly { field: string; value: string; documentId: string | null; id: string }[]
): ContainerSealMismatch[] {
  const byContainer = new Map<string, typeof facts[number][]>();
  for (const fact of facts) {
    const match = fact.field.match(/^container\.(.+)\.sealNumbers$/);
    if (!match) continue;
    const normalizedContainer = applyNorm(match[1], "container_id");
    if (!normalizedContainer) continue;
    const list = byContainer.get(normalizedContainer) ?? [];
    list.push(fact);
    byContainer.set(normalizedContainer, list);
  }

  const normalizeSealSet = (raw: string): string =>
    raw
      .split(",")
      .map((s) => applyNorm(s, "container_id"))
      .filter((s): s is string => !!s)
      .sort()
      .join("|");

  const mismatches: ContainerSealMismatch[] = [];
  for (const [normalizedContainerNumber, containerFacts] of byContainer) {
    const latestByDoc = new Map<string, typeof facts[number]>();
    for (const fact of containerFacts) {
      const key = fact.documentId ?? `no-document:${fact.id}`;
      if (!latestByDoc.has(key)) latestByDoc.set(key, fact);
    }
    const claims = [...latestByDoc.values()];
    if (claims.length < 2) continue;

    const sealKeys = new Set(claims.map((fact) => normalizeSealSet(fact.value)));
    if (sealKeys.size <= 1) continue;

    mismatches.push({ normalizedContainerNumber, claims });
  }
  return mismatches;
}

interface ComplianceAuditFinding {
  ruleId: string;
  category:
    | "PGA"
    | "ADD_CVD"
    | "UFLPA"
    | "VALUATION"
    | "HTS_INTEGRITY"
    | "DATA_MISSING"
    | "SCREENING_GAP"
    | "COUNTRY_EMBARGO"
    | "PRIVATE_EMBARGO"
    | "END_USE_RESTRICTION"
    | "END_USER_RESTRICTION"
    | "ANTI_BOYCOTT"
    | "MILITARY_END_USE"
    | "MILITARY_END_USER";
  passed: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  details: string;
  lineNumber?: number;
}

interface ComplianceAuditFlag {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category: string;
  summary: string;
  evidenceRef: string;
  suggestedAction: string;
}

const COMPLIANCE_EXCEPTION_CATEGORY: Record<ComplianceAuditFinding["category"], "COMPLIANCE" | "MISSING_DATA"> = {
  UFLPA: "COMPLIANCE",
  ADD_CVD: "COMPLIANCE",
  PGA: "COMPLIANCE",
  SCREENING_GAP: "COMPLIANCE",
  VALUATION: "COMPLIANCE",
  HTS_INTEGRITY: "COMPLIANCE",
  DATA_MISSING: "MISSING_DATA",
  COUNTRY_EMBARGO: "COMPLIANCE",
  PRIVATE_EMBARGO: "COMPLIANCE",
  END_USE_RESTRICTION: "COMPLIANCE",
  END_USER_RESTRICTION: "COMPLIANCE",
  ANTI_BOYCOTT: "COMPLIANCE",
  MILITARY_END_USE: "COMPLIANCE",
  MILITARY_END_USER: "COMPLIANCE",
};

function complianceExceptionCode(finding: ComplianceAuditFinding): string {
  const sanitizedRuleId = finding.ruleId.replace(/[^A-Z0-9]/gi, "_").toUpperCase();
  return `COMPLIANCE_${sanitizedRuleId}${finding.lineNumber != null ? `_L${finding.lineNumber}` : ""}`;
}

export interface ReconciliationResult {
  shipmentId: string;
  reconciledAt: string;
  conflictsDetected: number;
  exceptionsGenerated: number;
  exceptionsResolved: number;
  affectedAgents: string[];
}

export class ReconciliationEngine {
  /**
   * Reconciles all inputs, document extractions, and user edits for a shipment.
   * Generates or auto-resolves ExceptionItem records durably.
   */
  static async reconcileShipment(shipmentId: string, accountId: string, triggerSource: string = "SYSTEM"): Promise<ReconciliationResult> {
    const shipment = await db.shipment.findFirst({
      where: { id: shipmentId, accountId },
      include: {
        documents: { include: { parseVersions: true, extractionFields: true } },
        exceptionItems: { where: { status: { not: "Resolved" } } },
        shipmentParties: { include: { legalEntity: true } },
        importerOfRecord: true,
        lineItems: true,
      },
    });

    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }

    const affectedAgentsSet = new Set<string>();
    let exceptionsGenerated = 0;
    let exceptionsResolved = 0;

    // Cross-document field reconciliation
    const documentGroups: DocumentGroup[] = shipment.documents
      .filter((d) => d.extractionFields && d.extractionFields.length > 0)
      .map((d) => ({
        documentId: d.id,
        docType: d.docType,
        fields: d.extractionFields.map((f) => ({
          fieldName: toReconciliationFieldName(f.fieldName),
          value: f.value,
          confidence: f.confidence,
        })),
      }));

    const { results, evaluatedRuleIds } = runReconciliationEngine(documentGroups);
    const conflictsDetected = results.length;

    // Planned-vs-actual drift: the first-ever reading of a tracked field is
    // its implicit "plan" -- flag when a later reading (a correction or a
    // newly-extracted document) disagrees with that baseline.
    const planReadings: PlanFieldReading[] = shipment.documents.flatMap((d) =>
      d.extractionFields.map((f) => ({
        fieldKey: toReconciliationFieldName(f.fieldName),
        value: f.value,
        createdAt: f.createdAt.toISOString(),
        documentId: d.id,
        docType: d.docType,
      }))
    );
    const { results: planChangeResults, evaluatedFieldKeys: planEvaluatedFieldKeys } =
      detectPlanChanges(planReadings);

    const severityMap: Record<string, string> = {
      BLOCKING: "Critical",
      WARNING: "Warning",
      INFO: "Info",
    };

    const openIssues = await db.reconciliationIssue.findMany({
      where: { shipmentId: shipment.id, accountId: shipment.accountId, status: "Open" },
    });

    const evaluatedFields = new Set(evaluatedRuleIds);
    const CONFLICT_CODE_PREFIX = "CONFLICT:";

    for (const result of results) {
      const existing = openIssues.find((i) => i.field === result.ruleId);
      const severity = severityMap[result.severity] ?? "Warning";
      const data = {
        field: result.ruleId,
        severity,
        expectedValue: `${result.valueA} (${result.docTypeA})`,
        actualValue: `${result.valueB} (${result.docTypeB})`,
        sourceDocuments: [result.docTypeA, result.docTypeB],
      };

      if (existing) {
        await db.reconciliationIssue.update({ where: { id: existing.id }, data });
      } else {
        await db.reconciliationIssue.create({
          data: { ...data, shipmentId: shipment.id, accountId: shipment.accountId, status: "Open" },
        });
      }

      const exCode = `${CONFLICT_CODE_PREFIX}${result.ruleId}`;
      const exSeverity = result.severity === "BLOCKING" ? "High" : result.severity === "WARNING" ? "Medium" : "Low";
      const exDescription = `Value conflict on "${result.ruleId}": ${result.docTypeA} reports "${result.valueA}" but ${result.docTypeB} reports "${result.valueB}".`;
      const existingEx = await db.exceptionItem.findFirst({
        where: { shipmentId: shipment.id, accountId: shipment.accountId, code: exCode, status: { not: "Resolved" } },
        select: { id: true },
      });
      if (!existingEx) {
        await createExceptionItem({
          shipmentId: shipment.id,
          accountId: shipment.accountId,
          code: exCode,
          category: "CONFLICT",
          type: "data_mismatch",
          severity: exSeverity,
          blocking: result.severity === "BLOCKING",
          description: exDescription,
          requiredAction: "Review both source documents and accept the correct value, or flag both as wrong.",
          sourceAgent: "Reconciliation Engine",
        });
        exceptionsGenerated++;
        affectedAgentsSet.add("RECONCILIATION_ENGINE");
      } else {
        await db.exceptionItem.update({
          where: { id: existingEx.id },
          data: { severity: exSeverity, description: exDescription, blocking: result.severity === "BLOCKING" },
        });
      }
    }

    const resolvedRuleIds = new Set(results.map((r) => r.ruleId));
    const staleIssues = openIssues.filter(
      (i) => evaluatedFields.has(i.field) && !resolvedRuleIds.has(i.field)
    );
    const staleIds = staleIssues.map((i) => i.id);

    if (staleIds.length > 0) {
      await db.reconciliationIssue.updateMany({
        where: { id: { in: staleIds } },
        data: { status: "Resolved", resolvedAt: new Date() },
      });
      const staleCodes = staleIssues.map((i) => `${CONFLICT_CODE_PREFIX}${i.field}`);
      await db.exceptionItem.updateMany({
        where: { shipmentId: shipment.id, accountId: shipment.accountId, code: { in: staleCodes }, status: { not: "Resolved" } },
        data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource, resolvedByName: "Reconciliation Engine" },
      });
      exceptionsResolved += staleIssues.length;
    }

    const PLAN_CHANGE_CODE_PREFIX = "PLAN_CHANGED:";
    const openPlanIssues = openIssues.filter((i) => i.issueType === "PLAN_CHANGED");

    for (const result of planChangeResults) {
      const existing = openPlanIssues.find((i) => i.field === result.fieldKey);
      const data = {
        field: result.fieldKey,
        severity: "Warning",
        issueType: "PLAN_CHANGED",
        expectedValue: `${result.baselineValue} (baseline, ${result.baselineDocType})`,
        actualValue: `${result.currentValue} (current, ${result.currentDocType})`,
        sourceDocuments: [result.baselineDocType, result.currentDocType],
        sourceDocumentIds: [result.baselineDocumentId, result.currentDocumentId],
      };

      if (existing) {
        await db.reconciliationIssue.update({ where: { id: existing.id }, data });
      } else {
        await db.reconciliationIssue.create({
          data: { ...data, shipmentId: shipment.id, accountId: shipment.accountId, status: "Open" },
        });
      }

      const exCode = `${PLAN_CHANGE_CODE_PREFIX}${result.fieldKey}`;
      const exDescription = `"${result.fieldKey}" changed from "${result.baselineValue}" to "${result.currentValue}" after the shipment's original extraction.`;
      const existingEx = await db.exceptionItem.findFirst({
        where: { shipmentId: shipment.id, accountId: shipment.accountId, code: exCode, status: { not: "Resolved" } },
        select: { id: true },
      });
      if (!existingEx) {
        await createExceptionItem({
          shipmentId: shipment.id,
          accountId: shipment.accountId,
          code: exCode,
          category: "PLAN_CHANGE",
          type: "plan_drift",
          severity: "Medium",
          blocking: false,
          description: exDescription,
          requiredAction: "Confirm whether this change is expected, then resolve this exception.",
          sourceAgent: "Reconciliation Engine",
        });
        exceptionsGenerated++;
        affectedAgentsSet.add("RECONCILIATION_ENGINE");
      } else {
        await db.exceptionItem.update({
          where: { id: existingEx.id },
          data: { description: exDescription },
        });
      }
    }

    const resolvedPlanFieldKeys = new Set(planChangeResults.map((r) => r.fieldKey));
    const stalePlanIssues = openPlanIssues.filter(
      (i) => planEvaluatedFieldKeys.includes(i.field) && !resolvedPlanFieldKeys.has(i.field)
    );
    const stalePlanIds = stalePlanIssues.map((i) => i.id);

    if (stalePlanIds.length > 0) {
      await db.reconciliationIssue.updateMany({
        where: { id: { in: stalePlanIds } },
        data: { status: "Resolved", resolvedAt: new Date() },
      });
      const stalePlanCodes = stalePlanIssues.map((i) => `${PLAN_CHANGE_CODE_PREFIX}${i.field}`);
      await db.exceptionItem.updateMany({
        where: { shipmentId: shipment.id, accountId: shipment.accountId, code: { in: stalePlanCodes }, status: { not: "Resolved" } },
        data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource, resolvedByName: "Reconciliation Engine" },
      });
      exceptionsResolved += stalePlanIssues.length;
    }

    const activeExceptions = shipment.exceptionItems || [];

    // 0. Same-document gross < net weight sanity check -- a document is
    // internally inconsistent if its own stated gross weight is lower than
    // its own net weight. Flag for review only; never auto-swap the values,
    // so the originally extracted facts are preserved either way.
    const GROSS_LT_NET_CODE_PREFIX = "GROSS_LT_NET_WEIGHT:";
    const activeGrossLtNetExceptions = activeExceptions.filter((e) => e.code?.startsWith(GROSS_LT_NET_CODE_PREFIX));
    const currentGrossLtNetCodes = new Set<string>();

    for (const group of documentGroups) {
      const grossField = group.fields.find((f) => f.fieldName === "grossWeight" && f.value?.trim());
      const netField = group.fields.find((f) => f.fieldName === "netWeight" && f.value?.trim());
      if (!grossField || !netField) continue;

      const isBelow = isGrossWeightBelowNetWeight(grossField.value, netField.value);
      if (isBelow === null) continue;

      if (isBelow) {
        const code = `${GROSS_LT_NET_CODE_PREFIX}${group.documentId}`;
        currentGrossLtNetCodes.add(code);
        const existingEx = await db.exceptionItem.findFirst({
          where: { shipmentId: shipment.id, accountId: shipment.accountId, code, status: { not: "Resolved" } },
          select: { id: true },
        });
        if (!existingEx) {
          const doc = shipment.documents.find((d) => d.id === group.documentId);
          await createExceptionItem({
            shipmentId: shipment.id,
            accountId: shipment.accountId,
            documentId: group.documentId,
            code,
            fieldKey: "grossWeight",
            category: "VALIDATION",
            type: "data_mismatch",
            severity: "Medium",
            blocking: false,
            description: `${doc?.docType ?? "Document"}${doc?.fileName ? ` (${doc.fileName})` : ""} states a gross weight ("${grossField.value}") lower than its own net weight ("${netField.value}").`,
            requiredAction: "Review the source document and correct gross/net weight if misread. Do not swap the values without confirming against the source.",
            sourceAgent: "Reconciliation Engine",
          });
          exceptionsGenerated++;
          affectedAgentsSet.add("RECONCILIATION_ENGINE");
        }
      }
    }

    for (const existing of activeGrossLtNetExceptions) {
      if (existing.code && !currentGrossLtNetCodes.has(existing.code)) {
        await db.exceptionItem.update({
          where: { id: existing.id },
          data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource },
        });
        exceptionsResolved++;
      }
    }

    // 0b. Cross-document container seal-number mismatch. ContainerReconciler
    // (containerPackageReconciler.ts) only ever fills a currently-empty
    // ShipmentContainer field, so a second document's conflicting seal
    // numbers for the same container are silently discarded from the
    // curated record. Fact rows retain every document's claim regardless, so
    // compare those directly instead of trusting the merged record.
    const CONTAINER_SEAL_CODE_PREFIX = "CONTAINER_SEAL_MISMATCH:";
    const activeContainerSealExceptions = activeExceptions.filter((e) => e.code?.startsWith(CONTAINER_SEAL_CODE_PREFIX));
    const currentContainerSealCodes = new Set<string>();

    const sealFacts = await db.fact.findMany({
      where: {
        shipmentId: shipment.id,
        AND: [{ field: { startsWith: "container." } }, { field: { endsWith: ".sealNumbers" } }],
      },
      orderBy: { createdAt: "desc" },
    });

    const sealMismatches = findContainerSealMismatches(sealFacts);

    for (const { normalizedContainerNumber, claims } of sealMismatches) {
      const code = `${CONTAINER_SEAL_CODE_PREFIX}${normalizedContainerNumber}`;
      currentContainerSealCodes.add(code);
      const existingEx = await db.exceptionItem.findFirst({
        where: { shipmentId: shipment.id, accountId: shipment.accountId, code, status: { not: "Resolved" } },
        select: { id: true },
      });
      if (!existingEx) {
        const claimSummary = claims
          .map((fact) => {
            const doc = fact.documentId ? shipment.documents.find((d) => d.id === fact.documentId) : null;
            return `${doc?.docType ?? "Unknown document"}: "${fact.value}"`;
          })
          .join("; ");
        await createExceptionItem({
          shipmentId: shipment.id,
          accountId: shipment.accountId,
          code,
          fieldKey: "sealNumbers",
          category: "CONFLICT",
          type: "data_mismatch",
          severity: "Medium",
          blocking: false,
          description: `Container ${normalizedContainerNumber}: seal numbers disagree across documents (${claimSummary}).`,
          requiredAction: "Review the source documents and confirm the correct seal number(s) for this container.",
          sourceAgent: "Reconciliation Engine",
        });
        exceptionsGenerated++;
        affectedAgentsSet.add("RECONCILIATION_ENGINE");
      }
    }

    for (const existing of activeContainerSealExceptions) {
      if (existing.code && !currentContainerSealCodes.has(existing.code)) {
        await db.exceptionItem.update({
          where: { id: existing.id },
          data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource },
        });
        exceptionsResolved++;
      }
    }

    // 1. Check Missing Importer / Client
    const missingImporterException = activeExceptions.find((e) => e.code === "MISSING_IMPORTER_OF_RECORD");
    if (!shipment.importerOfRecordId && !shipment.clientId && shipment.shipmentParties.length === 0) {
      if (!missingImporterException) {
        await createExceptionItem({
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          code: "MISSING_IMPORTER_OF_RECORD",
          category: "MISSING_DATA",
          type: "compliance_flag",
          severity: "High",
          description: "No Importer of Record or Client entity assigned to this shipment.",
          blocking: true,
          requiredAction: "Assign a Client or Importer of Record entity",
          sourceAgent: "Reconciliation Engine",
        });
        exceptionsGenerated++;
        affectedAgentsSet.add("COMPLIANCE_AUDIT");
      }
    } else if (missingImporterException) {
      // Resolve exception
      await db.exceptionItem.update({
        where: { id: missingImporterException.id },
        data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource },
      });
      exceptionsResolved++;
    }

    // 1b. Party master revalidation -- swept every run, not just at the
    // moment a party is assigned, so a revalidation flag opened afterward is
    // still caught before filing.
    for (const shipmentParty of shipment.shipmentParties) {
      if (!shipmentParty.legalEntity?.partyId) continue;
      await ShipmentPartyService.checkPartyMasterRevalidation(
        shipment.id,
        shipmentParty.legalEntityId,
        shipment.accountId,
        null
      );
    }

    // 1c. Part/product master mismatch -- line items are classified by the
    // HTS agent independent of reconciliation, so a mismatch against the
    // canonical product master would otherwise only surface if/when that
    // agent happens to run again for this line.
    const canonicalProducts = await db.canonicalProduct.findMany({
      where: { accountId: shipment.accountId },
      include: { aliases: true },
    });
    const activePartMasterExceptions = activeExceptions.filter((e) => e.sourceAgent === "Part Master Match");
    const currentPartMasterKeys = new Set<string>();

    for (const item of shipment.lineItems) {
      if (!item.partNumber?.trim()) continue;
      const match = matchPartMaster(
        { partNumber: item.partNumber, proposedHtsCode: item.htsCode },
        canonicalProducts
      );

      if (match.matched && !match.htsAgrees) {
        const code = "PART_MASTER_MISMATCH";
        currentPartMasterKeys.add(`${code}:${item.lineNumber}`);
        await createExceptionItem({
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          documentId: null,
          code,
          fieldKey: "htsCode",
          category: "CLASSIFICATION",
          type: "data_mismatch",
          severity: "Medium",
          description: `Line ${item.lineNumber} (part ${item.partNumber}): proposed HTS code "${item.htsCode}" disagrees with the product master's HTS code "${match.masterHtsCode}".`,
          blocking: false,
          requiredAction: "Confirm the correct HTS code against the product master before filing.",
          sourceAgent: "Part Master Match",
        });
        exceptionsGenerated++;
        affectedAgentsSet.add("HTS_CLASSIFICATION");
      } else if (!match.matched) {
        const code = "PART_NOT_IN_MASTER";
        currentPartMasterKeys.add(`${code}:${item.lineNumber}`);
        await createExceptionItem({
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          documentId: null,
          code,
          fieldKey: "partNumber",
          category: "MISSING_DATA",
          type: "data_mismatch",
          severity: "Low",
          description: `Line ${item.lineNumber}: part number "${item.partNumber}" was not found in the product master.`,
          blocking: false,
          requiredAction: "Add this part to the product master, or confirm the part number is correct.",
          sourceAgent: "Part Master Match",
        });
        exceptionsGenerated++;
        affectedAgentsSet.add("HTS_CLASSIFICATION");
      }
    }

    for (const existing of activePartMasterExceptions) {
      const lineMatch = existing.description.match(/^Line (\d+)/);
      const key = existing.code && lineMatch ? `${existing.code}:${lineMatch[1]}` : null;
      if (key && !currentPartMasterKeys.has(key)) {
        await db.exceptionItem.update({
          where: { id: existing.id },
          data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource },
        });
        exceptionsResolved++;
      }
    }

    // 2. Check Line Items HTS Review Requirements
    const unreviewedItems = shipment.lineItems.filter(
      (item) => item.status === "Unreviewed" || (item.htsConfidence !== null && item.htsConfidence < 80)
    );
    const htsReviewException = activeExceptions.find((e) => e.code === "HTS_REVIEW_REQUIRED");

    if (unreviewedItems.length > 0) {
      if (!htsReviewException) {
        await createExceptionItem({
          accountId: shipment.accountId,
          shipmentId: shipment.id,
          code: "HTS_REVIEW_REQUIRED",
          category: "CLASSIFICATION",
          type: "data_mismatch",
          severity: "Medium",
          description: `${unreviewedItems.length} line item(s) require tariff classification review.`,
          blocking: false,
          requiredAction: "Review and confirm HTS classification codes",
          sourceAgent: "HTS Classification Agent",
        });
        exceptionsGenerated++;
        affectedAgentsSet.add("HTS_CLASSIFICATION");
      }
    } else if (htsReviewException) {
      await db.exceptionItem.update({
        where: { id: htsReviewException.id },
        data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource },
      });
      exceptionsResolved++;
    }

    // 3. Check for line-item fields LineItemReconciler had to placeholder --
    // never left missing, but flagged here the same way HTS review is, so a
    // human confirms the real value before it's relied on for filing.
    const lineItems = shipment.lineItems;

    // Every value a source actually supplied is recorded as a Fact, and only when
    // it was present -- LineItemReconciler.recordFacts skips null and empty. So
    // the presence of a fact is the out-of-band answer to "was this extracted?",
    // which the stored value alone cannot give: the placeholder for an unknown
    // quantity is 1, and a line legitimately shipping one unit is byte-identical
    // to it. Reading the sentinel alone reported 20 of this invoice's 68 lines as
    // having no quantity when all 68 were read correctly.
    const recordedFacts = await db.fact.findMany({
      where: {
        shipmentId: shipment.id,
        field: { startsWith: "lineItem." },
      },
      select: { field: true },
    });
    const factFields = new Set(recordedFacts.map((fact) => fact.field));
    const wasExtracted = (lineNumber: number, field: string) =>
      factFields.has(lineItemFactField(lineNumber, field));

    const defaultedFieldChecks: Array<{
      fieldKey: "quantity" | "unitPrice" | "countryOfOrigin";
      code: string;
      label: string;
      isDefaulted: (item: (typeof lineItems)[number]) => boolean;
    }> = [
      {
        fieldKey: "quantity",
        code: "MISSING_LINE_ITEM_QUANTITY",
        label: "Quantity",
        isDefaulted: (item) =>
          isPlaceholderValue("quantity", item.quantity, wasExtracted(item.lineNumber, "quantity")),
      },
      {
        fieldKey: "unitPrice",
        code: "MISSING_LINE_ITEM_UNIT_PRICE",
        label: "Unit Price",
        isDefaulted: (item) =>
          isPlaceholderValue("unitPrice", Number(item.unitPrice), wasExtracted(item.lineNumber, "unitPrice")),
      },
      {
        fieldKey: "countryOfOrigin",
        code: "MISSING_LINE_ITEM_COUNTRY_OF_ORIGIN",
        label: "Country of Origin",
        isDefaulted: (item) =>
          isPlaceholderValue(
            "countryOfOrigin",
            item.countryOfOrigin,
            wasExtracted(item.lineNumber, "countryOfOrigin")
          ),
      },
    ];

    const invoiceDoc = shipment.documents.find((d) => d.docType.toLowerCase().includes("invoice")) || shipment.documents[0];
    const docSuffix = invoiceDoc ? ` on ${invoiceDoc.fileName}` : "";

    for (const check of defaultedFieldChecks) {
      // Only rows still awaiting review carry this signal -- once a human
      // approves a row (status "Valid"), a lingering sentinel value is a
      // deliberate confirmed answer (e.g. a genuinely unknown origin), not a
      // still-open gap.
      const affectedLines = shipment.lineItems.filter((item) => item.status !== "Valid" && check.isDefaulted(item));
      const existing = activeExceptions.find((e) => e.code === check.code);

      if (affectedLines.length > 0) {
        if (!existing) {
          await createExceptionItem({
            accountId: shipment.accountId,
            shipmentId: shipment.id,
            documentId: invoiceDoc?.id ?? null,
            code: check.code,
            fieldKey: check.fieldKey,
            category: "MISSING_DATA",
            type: "data_mismatch",
            severity: "Medium",
            description: `${check.label} could not be extracted for ${affectedLines.length} line item(s) (line ${affectedLines
              .map((i) => i.lineNumber)
              .join(", ")})${docSuffix} -- confirm before filing.`,
            blocking: false,
            requiredAction: `Review and confirm ${check.label.toLowerCase()} for the affected line item(s)`,
            sourceAgent: "Line Item Reconciler",
          });
          exceptionsGenerated++;
          affectedAgentsSet.add("LINE_ITEM_RECONCILER");
        }
      } else if (existing) {
        await db.exceptionItem.update({
          where: { id: existing.id },
          data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource },
        });
        exceptionsResolved++;
      }
    }

    // 4. Sync Compliance Audit Agent's CRITICAL/HIGH findings into real
    // exceptions -- the deterministic auditResults are the dedup source
    // (stable ruleId/lineNumber), not the LLM-phrased flags, whose wording
    // can vary run to run for the same underlying finding.
    const latestComplianceDecision = await db.agentDecision.findFirst({
      where: { shipmentId: shipment.id, agentName: "Compliance Agent" },
      orderBy: { createdAt: "desc" },
    });
    const evidenceItems = latestComplianceDecision?.evidenceItems as
      | { auditResults?: ComplianceAuditFinding[]; flags?: ComplianceAuditFlag[] }
      | null
      | undefined;
    const auditResults = evidenceItems?.auditResults ?? [];
    const flags = evidenceItems?.flags ?? [];

    const activeComplianceExceptions = activeExceptions.filter((e) => e.sourceAgent === "Compliance Agent");
    const currentFindings = auditResults.filter(
      (r) => !r.passed && (r.severity === "CRITICAL" || r.severity === "HIGH")
    );
    const currentCodes = new Set(currentFindings.map(complianceExceptionCode));

    for (const finding of currentFindings) {
      const code = complianceExceptionCode(finding);
      if (activeComplianceExceptions.some((e) => e.code === code)) continue;

      const matchingFlag = flags.find(
        (f) => f.category === finding.category && (finding.lineNumber == null || f.evidenceRef.includes(`Line ${finding.lineNumber}`))
      );

      await createExceptionItem({
        accountId: shipment.accountId,
        shipmentId: shipment.id,
        code,
        category: COMPLIANCE_EXCEPTION_CATEGORY[finding.category],
        type: "compliance_flag",
        severity: finding.severity === "CRITICAL" ? "Critical" : "High",
        description: matchingFlag?.summary ?? finding.details,
        blocking: finding.severity === "CRITICAL",
        requiredAction: matchingFlag?.suggestedAction ?? "Manual compliance review required before filing.",
        sourceAgent: "Compliance Agent",
      });
      exceptionsGenerated++;
      affectedAgentsSet.add("COMPLIANCE_AUDIT");
    }

    for (const existing of activeComplianceExceptions) {
      if (existing.code && !currentCodes.has(existing.code)) {
        await db.exceptionItem.update({
          where: { id: existing.id },
          data: { status: "Resolved", resolvedAt: new Date(), resolvedBy: triggerSource },
        });
        exceptionsResolved++;
      }
    }

    // Always include Filing Readiness for score updates
    affectedAgentsSet.add("FILING_READINESS");

    const affectedAgents = Array.from(affectedAgentsSet);

    // Log reconciliation event
    await ShipmentEventBus.logEvent({
      shipmentId,
      accountId,
      eventType: "RECONCILIATION_REQUESTED",
      payload: {
        triggerSource,
        conflictsDetected,
        exceptionsGenerated,
        exceptionsResolved,
        affectedAgents,
      },
      triggeredBy: triggerSource,
    });

    // Recompute statutory and commercial deadline clocks.
    // Fire-and-forget: a deadline failure must never block the reconciliation
    // result from returning — deadlines are advisory, not gating.
    recomputeShipmentDeadlines(shipmentId, accountId).catch((err) =>
      console.error("[ReconciliationEngine] deadline recompute failed", { shipmentId, err })
    );

    return {
      shipmentId,
      reconciledAt: new Date().toISOString(),
      conflictsDetected,
      exceptionsGenerated,
      exceptionsResolved,
      affectedAgents,
    };
  }
}
