// Guardrail for the cross-tenant mutation bug class found repeatedly by manual
// audit passes in apps/tms (e.g. api/customs/webhook/route.ts's customsFiling
// and exceptionItem updateMany calls -- fixed by scoping every write below to
// a resolved accountId). This rule catches the next instance of that exact
// shape automatically instead of relying on the next audit to find it.
//
// Scope: `db.<model>.updateMany` / `tx.<model>.updateMany` and the `deleteMany`
// equivalents, for Prisma models that carry a direct accountId column (see
// TENANT_SCOPED_MODELS below, generated from packages/db/prisma/schema.prisma).
// updateMany/deleteMany are the highest-severity shape because a missing
// filter widens to every row of the model, not just the caller's own -- a
// single-row update() / delete() addressed by a unique id it already resolved
// under a checked accountId is a different, lower-risk shape and is
// deliberately out of scope for this first pass.
//
// TENANT_SCOPED_MODELS intentionally omits two models that this exact
// call shape shows up on constantly and safely: `pipelineJob` and
// `workflowOutboxEvent`. Both are internal queue/outbox tables claimed by a
// globally-unique job id via an optimistic-concurrency updateMany (id +
// status/attempt-count guard) -- the id is never caller-controlled and
// carries no cross-tenant exposure, so requiring accountId there would be
// pure noise. If a new call site on either model ever takes its id from
// request input, that is a different bug (an IDOR, not a missing tenant
// filter) and this rule is not the place to catch it.
const TENANT_SCOPED_MODELS = new Set([
  "shipmentSequence", "accountMembership", "role", "invitation", "auditLog", "idempotencyRecord", "shipment", "shipmentTrackingIdentifier",
  "shipmentLeg", "transportLeg", "shipmentStop", "shipmentLegDocument", "legInferenceRun", "shipmentLegEquipment", "shipmentEquipment", "trackingEvent",
  "etaObservation", "trackingSubscription", "complianceDeadline", "shipmentDocument", "documentAssociation", "inboundSenderRoute", "inboundEmail", "documentShipmentCandidate",
  "notification", "shipmentLineItem", "agentDecision", "agentPolicyConfig", "customsFiling", "customerRequest", "customerRequestMessage", "accountProductEntitlement",
  "shipmentProductWorkspace", "customsCase", "customsCaseShipment", "customsCaseDocument", "customsResponse", "landedCostScenario", "refundOpportunity", "postSummaryCorrection",
  "protest", "exportShipment", "exportDocument", "exportLineItem", "drawbackClaim", "complianceAuditRecord", "importerOfRecord", "client",
  "team", "impersonationSession", "bond", "powerOfAttorney", "legalEntity", "documentParseVersion", "exceptionItem", "fieldApproval",
  "agentExecutionRecord", "reconciliationIssue", "canonicalProduct", "complianceFinding", "supplierRiskScore", "brokerMetrics", "valuationAssistsRecord", "auditTimeline",
  "screeningLog", "accountEmbargoConfig", "privateEmbargoRule", "accountScreeningConfig", "embargoUsageHeader", "embargoUsageLine", "agentExecutionLog", "shipmentStateRecord",
  "classificationCase", "caseDocument", "classificationChangeImpact", "hydrationRun", "hydrationCandidate", "product",
  "productIdentifier", "productAttribute", "productComposition", "productParty", "productCountryFact", "productClassification", "productEvidence", "productChangeEvent",
  "productRevalidationFlag", "party", "partyName", "partyIdentifier", "partyRegistration", "partyAddress", "partyContact", "partyRole",
  "partyRelationship", "partySite", "partyEvidence", "partyChangeEvent", "partyRevalidationFlag", "aiUsageWindow", "assistantChatSession", "filingMessage",
  "workMetricSnapshot", "controlEvidence", "drawbackLot", "drawbackClaimSequence", "accountWebhook", "accountApiKey", "restrictedPartyScreeningResult", "communityScreeningRun",
  "communityScreeningPartyResult", "complianceBatch", "complianceBatchColumnMappingTemplate", "batchRecord", "batchArtifact", "restrictedPartyDisposition", "partyScreeningSummary", "partyScreeningApproval",
  "rdpsPartyOutcome", "complianceNotification", "complianceScreeningFinding", "complianceExecution", "complianceFormalOverride", "reportDefinition", "reportRun", "reportArtifact",
  "reportSchedule", "licenseDeterminationResult", "license", "licenseLine", "licenseParty", "licenseDocument", "licenseEvent", "licenseAdjustment",
  "licenseNote", "licenseAllocation", "accountLicenseConfig", "billingEventDefinition", "rateCard", "costProfile", "usageEvent", "shipmentCharge",
  "shipmentCost", "invoice", "payment", "billingException", "accountMemory", "memoryEvidence", "integrationConfig", "integrationPayload",
  "integrationSyncLog", "integrationEntityMap", "inBondRecord", "manifestRecord", "statementRecord", "abiFilerCredential", "transportationOrder", "carrierProfile",
  "movement", "shipmentMovement", "movementStop", "transportationEvent", "carrier", "carrierRate", "freightQuote", "tender",
  "proofOfDelivery", "carrierInvoice", "carrierInvoiceLine", "shipmentStageHistory", "pipelineStageRun", "stageGatePolicy", "slaPolicy", "escalationRule",
  "escalationEvent", "onboardingCase", "onboardingEntity", "fiveOhSixRecord", "bondVerification", "poaTemplate", "poaEnvelope", "brokerComplianceProfile",
  "onboardingEvent", "pgaHold", "pgaHoldSubmission", "assist", "assistDecision", "assistDeclaration",
]);

const CLIENT_RECEIVER_NAMES = new Set(["db", "tx"]);
const GUARDED_METHODS = new Set(["updateMany", "deleteMany"]);

// Walks the `where` object looking for an `accountId` key at any depth,
// including inside AND/OR/NOT arrays -- but bails out (treats it as scoped)
// the moment it finds a spread element or a computed/non-object sub-filter,
// since a lint rule can't verify what a spread or a variable reference
// resolves to and a false positive here is worse than a missed true positive.
function containsAccountIdKey(objectExpression) {
  for (const prop of objectExpression.properties) {
    if (prop.type === "SpreadElement") return true;
    if (prop.type !== "Property") continue;
    const keyName = prop.key.type === "Identifier" ? prop.key.name : prop.key.value;
    if (keyName === "accountId") return true;
    if ((keyName === "AND" || keyName === "OR" || keyName === "NOT") && prop.value) {
      const branches = prop.value.type === "ArrayExpression" ? prop.value.elements : [prop.value];
      for (const branch of branches) {
        if (branch && branch.type === "ObjectExpression" && containsAccountIdKey(branch)) return true;
      }
    }
  }
  return false;
}

export default {
  rules: {
    "tenant-scoped-write": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Require an accountId filter on Prisma updateMany/deleteMany calls against tenant-scoped models.",
        },
        schema: [],
        messages: {
          missingAccountId:
            "'{{model}}.{{method}}' has no accountId in its where clause. This model is tenant-scoped -- " +
            "an unfiltered updateMany/deleteMany can mutate every tenant's rows, not just the caller's. " +
            "Add accountId (or, if the target row was already resolved under a checked accountId earlier " +
            "in this function, add a one-line eslint-disable-next-line comment explaining that).",
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            const callee = node.callee;
            if (callee.type !== "MemberExpression" || callee.computed) return;
            const method = callee.property.name;
            if (!GUARDED_METHODS.has(method)) return;

            const modelAccess = callee.object;
            if (modelAccess.type !== "MemberExpression" || modelAccess.computed) return;
            if (modelAccess.object.type !== "Identifier" || !CLIENT_RECEIVER_NAMES.has(modelAccess.object.name)) return;

            const model = modelAccess.property.name;
            if (!TENANT_SCOPED_MODELS.has(model)) return;

            const [arg] = node.arguments;
            if (!arg || arg.type !== "ObjectExpression") return;

            const whereProp = arg.properties.find(
              (p) => p.type === "Property" && (p.key.type === "Identifier" ? p.key.name : p.key.value) === "where"
            );
            // No `where` at all is the worst case (every row of the model), so it's
            // flagged same as an explicit where missing accountId. A `where` whose
            // value isn't a literal object (a variable, a spread build-up) can't be
            // statically verified -- skip it rather than risk a false positive.
            if (whereProp && whereProp.value.type !== "ObjectExpression") return;

            if (!whereProp || !containsAccountIdKey(whereProp.value)) {
              context.report({ node, messageId: "missingAccountId", data: { model, method } });
            }
          },
        };
      },
    },
  },
};
