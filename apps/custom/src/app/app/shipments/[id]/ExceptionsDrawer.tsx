"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, FileText, CheckCircle2, Pencil, Mail, X, Loader2 } from "lucide-react";
import { ExceptionResolutionModal } from "./ExceptionResolutionModal";
import { DocumentFieldReviewModal, DocumentFieldSummary } from "./DocumentFieldReviewModal";
import { DocumentReviewPanel } from "@/components/DocumentReviewPanel";
import { Modal } from "@/components/ui/Modal";
import { documentViewUrl } from "@/lib/documentUrl";
import { canonicalizeFieldKey } from "@/lib/documents/fieldDictionary";
import { normalizeExceptionStatus, isTerminalExceptionState } from "@/modules/exceptions/exceptionState";
import {
  isResolvableException,
  type DbExceptionItem,
  type ExceptionCard,
  type ResolvableException,
  type ShipmentLineItemRow,
} from "./workspaceTypes";

export interface ReconciliationIssueRow {
  id: string;
  field: string;
  severity: string;
  expectedValue: string;
  actualValue: string;
  sourceDocuments: string[];
  status: string;
}

interface ExceptionsDrawerProps {
  shipmentId: string;
  exceptionItems: DbExceptionItem[];
  lineItems: ShipmentLineItemRow[];
  // Required document types not yet uploaded, computed by the page from the
  // live document list -- surfaced here as real action cards instead of
  // living only in a separate, disconnected "Document Set Summary" box.
  missingDocumentTypes?: string[];
  // What fields we expect from each processed document, and whether each
  // one was found/confirmed -- computed server-side in page.tsx from real
  // extraction + FieldApproval data. Drives the "Document Field Review"
  // cards below, so exceptions that all trace back to one document read as
  // one review task instead of a flat, ungrouped list.
  documentFieldSummaries?: DocumentFieldSummary[];
  // Cross-document reconciliation conflicts — each Open ReconciliationIssue row.
  reconciliationIssues?: ReconciliationIssueRow[];
}

export function ExceptionsDrawer({
  shipmentId,
  exceptionItems,
  lineItems,
  missingDocumentTypes = [],
  documentFieldSummaries = [],
  reconciliationIssues = [],
}: ExceptionsDrawerProps) {
  const router = useRouter();

  const [panelTab, setPanelTab] = useState<"EXCEPTIONS" | "FIELD_REVIEW">("EXCEPTIONS");
  const [selectedException, setSelectedException] = useState<ResolvableException | null>(null);
  const [reviewingDoc, setReviewingDoc] = useState<DocumentFieldSummary | null>(null);
  const [selectedPdfDoc, setSelectedPdfDoc] = useState<DocumentFieldSummary | null>(null);

  const [approvingField, setApprovingField] = useState<string | null>(null);
  const [batchApprovingDoc, setBatchApprovingDoc] = useState<string | null>(null);
  const [fieldReviewError, setFieldReviewError] = useState<string | null>(null);

  const [editingFieldKey, setEditingFieldKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [savingInlineField, setSavingInlineField] = useState<string | null>(null);
  const [resolvingConflictId, setResolvingConflictId] = useState<string | null>(null);
  const [requestingDocType, setRequestingDocType] = useState<string | null>(null);
  const [requestEmail, setRequestEmail] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSentFor, setRequestSentFor] = useState<string | null>(null);

  const [customerUsersList, setCustomerUsersList] = useState<Array<{ id: string; email: string; name: string }>>([]);
  const [loadingCustomerUsers, setLoadingCustomerUsers] = useState(false);

  useEffect(() => {
    if (requestingDocType) {
      setLoadingCustomerUsers(true);
      fetch("/api/broker/customer-users")
        .then((res) => res.json())
        .then((data) => {
          if (data.customerUsers && Array.isArray(data.customerUsers)) {
            setCustomerUsersList(data.customerUsers);
            if (data.customerUsers.length > 0 && !requestEmail) {
              setRequestEmail(data.customerUsers[0].email);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCustomerUsers(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed the default once per doc-type open, not on every keystroke in requestEmail
  }, [requestingDocType]);

  const postFieldReview = async (
    docId: string,
    body: { fieldKey: string; action: string; value?: string }
  ): Promise<boolean> => {
    const res = await fetch(`/api/shipments/${shipmentId}/documents/${docId}/field-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error?.message ?? data.message ?? `Save failed (${res.status})`);
    }
    return true;
  };

  const handleInlineEditSave = async (docId: string, fieldKey: string) => {
    if (!editingValue.trim()) return;
    const key = `${docId}:${fieldKey}`;
    setSavingInlineField(key);
    setFieldReviewError(null);
    try {
      await postFieldReview(docId, { fieldKey, action: "EDIT", value: editingValue.trim() });
      setEditingFieldKey(null);
      router.refresh();
    } catch (err) {
      setFieldReviewError(err instanceof Error ? err.message : "Field review edit failed");
    } finally {
      setSavingInlineField(null);
    }
  };

  const handleInlineApprove = async (docId: string, fieldKey: string, value: string) => {
    const key = `${docId}:${fieldKey}`;
    setApprovingField(key);
    setFieldReviewError(null);
    try {
      await postFieldReview(docId, { fieldKey, action: "APPROVE", value });
      router.refresh();
    } catch (err) {
      setFieldReviewError(err instanceof Error ? err.message : "Field review approval failed");
    } finally {
      setApprovingField(null);
    }
  };

  const handleResolveConflict = async (
    issueId: string,
    action: "resolve" | "ignore",
    resolution?: "ACCEPTED_A" | "ACCEPTED_B" | "BOTH_WRONG" | "ACKNOWLEDGED"
  ) => {
    setResolvingConflictId(issueId);
    setFieldReviewError(null);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/reconcile/issues/${issueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, resolution }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? data.message ?? `Could not resolve conflict (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setFieldReviewError(err instanceof Error ? err.message : "Conflict resolution failed");
    } finally {
      setResolvingConflictId(null);
    }
  };

  const handleSendDocumentRequest = async () => {
    if (!requestingDocType || !requestEmail.trim()) return;
    setSendingRequest(true);
    try {
      await fetch(`/api/shipments/${shipmentId}/documents/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentType: requestingDocType, recipientEmail: requestEmail.trim() }),
      });
      setRequestSentFor(requestingDocType);
      setRequestingDocType(null);
      setRequestEmail("");
    } catch {
      // Silent — the modal stays open so the user can retry.
    } finally {
      setSendingRequest(false);
    }
  };

  const handleBatchApprove = async (doc: DocumentFieldSummary) => {
    setBatchApprovingDoc(doc.documentId);
    setFieldReviewError(null);
    try {
      const unconfirmed = doc.fields.filter((f) => f.status === "NEEDS_REVIEW" && f.value);
      const results = await Promise.allSettled(
        unconfirmed.map((f) =>
          postFieldReview(doc.documentId, { fieldKey: f.key, action: "APPROVE", value: f.value! })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setFieldReviewError(`${failed} of ${unconfirmed.length} field${failed === 1 ? "" : "s"} could not be confirmed.`);
      }
      router.refresh();
    } catch (err) {
      setFieldReviewError(err instanceof Error ? err.message : "Batch approval failed");
    } finally {
      setBatchApprovingDoc(null);
    }
  };

  // Filter out exceptions that have reached a terminal state — resolved, waived,
  // or cancelled. Without the waived/cancelled cases a card stayed on screen
  // unchanged after the user waived it, reading as "nothing happened". Cross-
  // document conflicts (`CONFLICT:*`) are rendered from the ReconciliationIssue
  // rows below, so the paired ExceptionItem the engine also writes is dropped
  // here to avoid the same conflict showing up twice.
  const openExceptions = exceptionItems.filter((ex) => {
    const normalized = normalizeExceptionStatus(ex.status);
    if (normalized && isTerminalExceptionState(normalized)) return false;
    return !(ex.code || "").startsWith("CONFLICT:");
  });

  const docNameById = new Map(documentFieldSummaries.map((d) => [d.documentId, d.fileName]));

  // Map database exception items to UI objects
  const exceptions: ExceptionCard[] = openExceptions.map((dbEx) => {
    const descLower = dbEx.description.toLowerCase();
    const isHts = descLower.includes("hts");
    const isCo = descLower.includes("certificate of origin");
    const isCoo = descLower.includes("country of origin");
    const isQty = descLower.includes("quantity") || descLower.includes("pcs") || descLower.includes("mismatch");
    const isPoa = descLower.includes("poa") || descLower.includes("power of attorney");
    const isInvoiceMissing = descLower.includes("commercial invoice missing");
    const isPackingMissing = descLower.includes("packing list missing");
    // A per-document field exception (`MISSING_EXTRACTION:<snake_key>`) — it
    // resolves by supplying the value, not by waiving.
    const isFieldException =
      Boolean(dbEx.documentId && dbEx.fieldKey) &&
      (dbEx.code || "").startsWith("MISSING_EXTRACTION:");

    let category = "VALIDATION";
    let title = dbEx.description.split(":")[0]?.trim() || "Compliance Exception";
    let desc = dbEx.description.split(":").slice(1).join(":")?.trim() || dbEx.description;
    let icon = <AlertCircle className="w-4 h-4 text-red-500" />;
    let actionText = "Resolve Exception →";
    let actionType = "DEFAULT";

    if (isInvoiceMissing) {
      category = "MISSING";
      title = "Commercial Invoice Missing";
      icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
      actionText = "Add Invoice →";
      actionType = "UPLOAD";
    } else if (isPackingMissing) {
      category = "MISSING";
      title = "Packing List Missing";
      icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
      actionText = "Add Packing List →";
      actionType = "UPLOAD";
    } else if (isHts) {
      category = "VALIDATION";
      title = "HTS Classification Review";
      icon = <AlertCircle className="w-4 h-4 text-red-500" />;
      actionText = "Review Classification →";
      actionType = "HTS";
    } else if (isCo) {
      category = "MISSING";
      title = "Certificate of Origin Missing";
      icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
      actionText = "Add Document →";
      actionType = "UPLOAD";
    } else if (isCoo) {
      category = "MISSING";
      title = "Country of Origin Missing";
      icon = <Info className="w-4 h-4 text-blue-500" />;
      actionText = "Provide Origin →";
      actionType = "COO";
    } else if (isQty) {
      category = "CONFLICTS";
      title = "Quantity Mismatch";
      icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
      actionText = "Review Mismatch →";
      actionType = "MISMATCH";
    } else if (isPoa) {
      category = "CONFLICTS";
      title = "Importer POA Expired";
      icon = <AlertCircle className="w-4 h-4 text-red-500" />;
      actionText = "Renew POA Consent →";
      actionType = "POA";
    }

    // Compliance Audit's findings (embargo/UFLPA/ADD-CVD/PGA/missing HTS or
    // origin) are grounded in the real DB `category` column, not description
    // keywords -- their wording can coincidentally match one of the phrases
    // above (e.g. "missing an HTS classification" matching isHts) and land in
    // the wrong tab/action with a special mutation meant for a different
    // exception type. Override using the real column for this source only, so
    // the three original checks above are untouched.
    if (dbEx.sourceAgent === "Compliance Agent") {
      const complianceCategory: Record<string, string> = {
        COMPLIANCE: "WARNINGS",
        MISSING_DATA: "MISSING",
      };
      category = (dbEx.category && complianceCategory[dbEx.category]) || "WARNINGS";
      actionType = "DEFAULT";
      actionText = "Resolve Exception →";
      icon =
        dbEx.severity === "Critical" ? (
          <AlertCircle className="w-4 h-4 text-red-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        );
      title = dbEx.category === "MISSING_DATA" ? "Missing Compliance Data" : "Sanctions / Compliance Finding";
      desc = dbEx.description;
    }

    // Planned-vs-actual drift findings are grounded in the real DB `category`
    // column too -- their description embeds the raw field name (e.g.
    // "totalQuantity"), which can coincidentally contain a keyword phrase
    // above (e.g. "quantity") and get mislabeled as a cross-document mismatch
    // with an action that doesn't apply to a single-field drift finding.
    if (dbEx.category === "PLAN_CHANGE") {
      category = "CONFLICTS";
      title = dbEx.description.split('"')[1]?.trim() || "Plan Changed";
      desc = dbEx.description;
      icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
      actionText = "Resolve Exception →";
      actionType = "DEFAULT";
    }

    // A per-document field exception always resolves by supplying the value —
    // this overrides any keyword match above (e.g. "Country of Origin was not
    // extracted" must not open the HTS/COO flows).
    if (isFieldException) {
      category = "FIELDS";
      title = dbEx.description.split(" was not ")[0]?.trim() || dbEx.description;
      desc = dbEx.description;
      icon = <Pencil className="w-4 h-4 text-brand" />;
      actionText = "Provide value →";
      actionType = "FIELD_CORRECTION";
    }

    const docSummary = dbEx.documentId
      ? documentFieldSummaries.find((d) => d.documentId === dbEx.documentId)
      : undefined;
    const exCanonical = canonicalizeFieldKey(dbEx.fieldKey);
    const currentValue = isFieldException
      ? docSummary?.fields.find(
          (f) => f.key === dbEx.fieldKey || canonicalizeFieldKey(f.key) === exCanonical
        )?.value ?? null
      : null;

    return {
      id: dbEx.id,
      dbId: dbEx.id,
      version: dbEx.version,
      category,
      title,
      desc,
      icon,
      actionText,
      actionType,
      documentId: dbEx.documentId ?? null,
      fieldKey: dbEx.fieldKey ?? null,
      code: dbEx.code ?? null,
      dbCategory: dbEx.category ?? null,
      currentValue,
      groupLabel: dbEx.documentId ? docNameById.get(dbEx.documentId) ?? "Document field review" : undefined,
    };
  });

  // Missing required documents the page detected directly from the live
  // document list -- skip any type already represented by a real DB
  // exception above so the same gap isn't shown twice.
  const missingDocExceptions: ExceptionCard[] = missingDocumentTypes
    .filter((type) => !exceptions.some((ex) => ex.title.toLowerCase().includes(type.toLowerCase())))
    .map((type) => ({
      id: `missing-doc-${type}`,
      category: "MISSING",
      title: `${type} Missing`,
      desc: `Required for customs entry filing. Upload the ${type} to clear this requirement.`,
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      actionText: `Add ${type} →`,
      actionType: "UPLOAD_DIRECT",
      groupLabel: "Missing documents",
    }));

  // Cross-document reconciliation conflicts from the field-comparison engine.
  // `issue.field` is the rule id (e.g. "QTY_INV_PACK") — turn it into a label.
  const CONFLICT_LABELS: Record<string, string> = {
    QTY_INV_PACK: "Quantity: invoice vs packing list",
    QTY_INV_BL: "Quantity: invoice vs bill of lading",
    VAL_INV_PACK: "Total value: invoice vs packing list",
    CURR_INV_PACK: "Currency: invoice vs packing list",
    CURR_INV_BL: "Currency: invoice vs bill of lading",
    WEIGHT_INV_PACK: "Gross weight: invoice vs packing list",
    WEIGHT_PACK_BL: "Gross weight: packing list vs bill of lading",
    ORIGIN_COO_INV: "Country of origin: certificate vs invoice",
    BL_NUM_INV_BL: "B/L number: invoice vs bill of lading",
    CONTAINER_BL_PACK: "Container number: bill of lading vs packing list",
  };
  const conflictExceptions: (ExceptionCard & { conflictIssueId: string })[] = reconciliationIssues
    .filter((issue) => issue.status === "Open")
    .map((issue) => {
      const isBlocking = issue.severity === "Critical";
      return {
        id: `conflict-${issue.id}`,
        conflictIssueId: issue.id,
        category: "CONFLICTS",
        title: CONFLICT_LABELS[issue.field] || issue.field.replace(/_/g, " "),
        desc: `${issue.expectedValue} vs ${issue.actualValue}${issue.sourceDocuments.length ? ` — ${issue.sourceDocuments.join(", ")}` : ""}.`,
        icon: isBlocking ? (
          <AlertCircle className="w-4 h-4 text-red-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        ),
        actionText: "Resolve Conflict →",
        actionType: "CONFLICT",
        groupLabel: "Cross-document conflicts",
        conflict: {
          field: issue.field,
          expectedValue: issue.expectedValue,
          actualValue: issue.actualValue,
          sources: issue.sourceDocuments,
        },
      };
    });

  const allExceptions = [...exceptions, ...missingDocExceptions, ...conflictExceptions];
  const totalPendingFields = documentFieldSummaries.reduce(
    (acc, doc) => acc + (doc.totalCount - doc.confirmedCount),
    0
  );

  // Group cards so the list stays scannable as volume grows (finding #8):
  // conflicts first, then missing documents, then per-document field gaps,
  // then everything else.
  const GROUP_ORDER = ["Cross-document conflicts", "Missing documents"];
  const groupFor = (ex: ExceptionCard): string => {
    if (ex.groupLabel) return ex.groupLabel;
    if (ex.category === "CONFLICTS") return "Cross-document conflicts";
    if (ex.category === "MISSING") return "Missing documents";
    return "Compliance findings";
  };
  const groupedExceptions = new Map<string, ExceptionCard[]>();
  for (const ex of allExceptions) {
    const g = groupFor(ex);
    const arr = groupedExceptions.get(g) ?? [];
    arr.push(ex);
    groupedExceptions.set(g, arr);
  }
  const rank = (g: string) => {
    const i = GROUP_ORDER.indexOf(g);
    if (i !== -1) return i;
    if (g === "Compliance findings") return 98;
    return 50; // per-document groups, alphabetical among themselves
  };
  const groupEntries = [...groupedExceptions.entries()].sort(
    (a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])
  );

  return (
    <>
      <div className="bg-white p-6 rounded-2xl border border-border shadow-2xs space-y-5 animate-in fade-in duration-200">
        {/* Top Navigation Pill Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-3 text-xs gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Standalone Pill 1: Exceptions */}
            <button
              type="button"
              onClick={() => setPanelTab("EXCEPTIONS")}
              className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center space-x-2 border shadow-2xs ${
                panelTab === "EXCEPTIONS"
                  ? "bg-brand text-white border-brand ring-2 ring-brand/20"
                  : "bg-white text-ink border-border hover:bg-surface-muted hover:border-slate-300"
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${panelTab === "EXCEPTIONS" ? "text-white" : "text-amber-500"}`} />
              <span>Exceptions & Action Items ({allExceptions.length})</span>
              {allExceptions.length > 0 && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    panelTab === "EXCEPTIONS"
                      ? "bg-white/20 text-white"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  {allExceptions.length} Action{allExceptions.length === 1 ? "" : "s"}
                </span>
              )}
            </button>

            {/* Standalone Pill 2: Document Field Review */}
            <button
              type="button"
              onClick={() => setPanelTab("FIELD_REVIEW")}
              className={`px-4 py-2 rounded-full font-bold text-xs transition-all cursor-pointer flex items-center space-x-2 border shadow-2xs ${
                panelTab === "FIELD_REVIEW"
                  ? "bg-brand text-white border-brand ring-2 ring-brand/20"
                  : "bg-white text-ink border-border hover:bg-surface-muted hover:border-slate-300"
              }`}
            >
              <FileText className={`w-3.5 h-3.5 ${panelTab === "FIELD_REVIEW" ? "text-white" : "text-brand"}`} />
              <span>Document Field Review ({documentFieldSummaries.length})</span>
              {totalPendingFields > 0 ? (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    panelTab === "FIELD_REVIEW"
                      ? "bg-amber-400 text-amber-950 font-extrabold"
                      : "bg-amber-100 text-amber-900 border border-amber-300"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  {totalPendingFields} Pending Approval
                </span>
              ) : documentFieldSummaries.length > 0 ? (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    panelTab === "FIELD_REVIEW"
                      ? "bg-emerald-400 text-emerald-950 font-extrabold"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-300"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                  All Confirmed
                </span>
              ) : null}
            </button>
          </div>

          <Link
            href={`/app/actions?shipmentId=${shipmentId}`}
            className="text-xs font-semibold text-brand hover:underline shrink-0"
          >
            View All Actions →
          </Link>
        </div>

        {/* Tab 1: Exceptions & Action Items — grouped for scannability */}
        {panelTab === "EXCEPTIONS" && (
          <div className="space-y-5 pt-1">
            {groupEntries.map(([groupName, cards]) => (
              <div key={groupName} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                    {groupName}
                  </h4>
                  <span className="text-[10px] font-bold text-ink-muted bg-surface-muted border border-border rounded-full px-1.5">
                    {cards.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {cards.map((ex) => (
              <div
                key={ex.id}
                className="p-4 rounded-xl bg-surface-muted border border-border space-y-2 hover:border-brand transition-all duration-200"
              >
                <div className="flex items-start space-x-2 text-xs font-bold text-ink">
                  <span className="shrink-0">{ex.icon}</span>
                  <span className="min-w-0 break-words">{ex.title}</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">{ex.desc}</p>
                {ex.actionType === "UPLOAD_DIRECT" ? (
                  <div className="space-y-1.5 pt-1">
                    <button
                      onClick={() => window.dispatchEvent(new Event("qubere:open-upload-modal"))}
                      className="text-xs font-semibold text-brand hover:underline text-left block w-full cursor-pointer"
                    >
                      {ex.actionText}
                    </button>
                    {requestSentFor === ex.title.replace(" Missing", "") ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Request sent
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setRequestingDocType(ex.title.replace(" Missing", ""));
                          setRequestEmail("");
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-muted hover:text-brand cursor-pointer"
                      >
                        <Mail className="w-3 h-3" /> Request from counterparty
                      </button>
                    )}
                  </div>
                ) : ex.actionType === "CONFLICT" && "conflictIssueId" in ex ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(() => {
                      const conflictEx = ex as typeof ex & { conflictIssueId: string };
                      const isResolving = resolvingConflictId === conflictEx.conflictIssueId;
                      const [sourceA, sourceB] = conflictEx.conflict?.sources ?? [];
                      return (
                        <>
                          <button
                            onClick={() => handleResolveConflict(conflictEx.conflictIssueId, "resolve", "ACCEPTED_A")}
                            disabled={isResolving}
                            title={conflictEx.conflict?.expectedValue}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Use {sourceA || "first"} value
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflictEx.conflictIssueId, "resolve", "ACCEPTED_B")}
                            disabled={isResolving}
                            title={conflictEx.conflict?.actualValue}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Use {sourceB || "second"} value
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflictEx.conflictIssueId, "resolve", "ACKNOWLEDGED")}
                            disabled={isResolving}
                            title="Neither value is corrected yet — defer for investigation without picking a winner."
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isResolving ? "Resolving…" : "Defer"}
                          </button>
                          <button
                            onClick={() => handleResolveConflict(conflictEx.conflictIssueId, "ignore")}
                            disabled={isResolving}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Ignore
                          </button>
                        </>
                      );
                    })()}
                  </div>
                ) : ex.actionType ? (
                  <button
                    onClick={() => {
                      if (isResolvableException(ex)) setSelectedException(ex);
                    }}
                    className="text-xs font-semibold text-brand hover:underline text-left pt-1 block w-full cursor-pointer"
                  >
                    {ex.actionText}
                  </button>
                ) : (
                  <Link
                    href={ex.actionHref || "#"}
                    className="inline-block text-xs font-semibold text-brand hover:underline pt-1"
                  >
                    {ex.actionText}
                  </Link>
                )}
              </div>
                  ))}
                </div>
              </div>
            ))}
            {allExceptions.length === 0 && (
              <div className="py-8 text-center text-ink-muted text-xs">
                No open exceptions for this shipment.
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Document Field Review & Approval Grid */}
        {panelTab === "FIELD_REVIEW" && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted">
                Extracted Document Fields & Verification
              </p>
              <span className="text-[10px] text-ink-muted">
                Review OCR extracted values directly or click Approve All
              </span>
            </div>
            {fieldReviewError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] font-semibold text-red-800">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{fieldReviewError}</span>
                <button
                  onClick={() => setFieldReviewError(null)}
                  className="ml-auto text-red-500 hover:text-red-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {documentFieldSummaries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documentFieldSummaries.map((doc) => {
                  const allConfirmed = doc.confirmedCount === doc.totalCount;
                  const unconfirmedCount = doc.totalCount - doc.confirmedCount;
                  const isBatchLoading = batchApprovingDoc === doc.documentId;
                  const bulkEligibleCount = doc.fields.filter((f) => f.status === "NEEDS_REVIEW" && f.value).length;
                  return (
                    <div
                      key={doc.documentId}
                      className="p-4 rounded-xl border border-border bg-[#F9F9FB] space-y-3 transition-all duration-200"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-brand shrink-0" />
                          <button
                            type="button"
                            onClick={() => setSelectedPdfDoc(doc)}
                            className="text-xs font-bold text-ink truncate hover:underline hover:text-brand text-left cursor-pointer"
                          >
                            {doc.fileName}
                          </button>
                          {unconfirmedCount > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                              {unconfirmedCount} Pending
                            </span>
                          )}
                        </div>
                        {!allConfirmed && bulkEligibleCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleBatchApprove(doc)}
                            disabled={isBatchLoading}
                            title="Confirms fields with a value and no cross-document conflict. Conflicts and missing fields are never bulk-accepted."
                            className="px-2.5 py-1 rounded-lg bg-brand text-white text-[11px] font-semibold hover:bg-brand/90 disabled:opacity-50 transition-all shrink-0 cursor-pointer shadow-2xs"
                          >
                            {isBatchLoading ? "Accepting…" : `Accept Reviewable (${bulkEligibleCount})`}
                          </button>
                        )}
                        {allConfirmed && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            All Confirmed
                          </span>
                        )}
                      </div>

                      {/* Flat Inline List of Extracted Fields */}
                      <div className="space-y-2">
                        {doc.fields.map((f) => {
                          const fieldKeyId = `${doc.documentId}:${f.key}`;
                          const fieldLoading = approvingField === fieldKeyId;
                          const isEditing = editingFieldKey === fieldKeyId;

                          if (isEditing) {
                            return (
                              <div
                                key={f.key}
                                className="flex items-center justify-between gap-2 text-xs p-2.5 rounded-lg bg-amber-50/70 border border-amber-300"
                              >
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                                    {f.label}
                                  </span>
                                  <input
                                    type="text"
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleInlineEditSave(doc.documentId, f.key);
                                      if (e.key === "Escape") setEditingFieldKey(null);
                                    }}
                                    autoFocus
                                    className="w-full mt-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-amber-300 text-ink focus:outline-none focus:ring-1 focus:ring-brand shadow-2xs"
                                    placeholder={`Enter ${f.label}…`}
                                  />
                                </div>
                                <div className="shrink-0 flex items-center gap-1.5 self-end pb-0.5">
                                  <button
                                    type="button"
                                    onClick={() => handleInlineEditSave(doc.documentId, f.key)}
                                    disabled={savingInlineField === fieldKeyId || !editingValue.trim()}
                                    className="px-2.5 py-1 rounded-md bg-brand text-white text-[11px] font-semibold hover:bg-brand/90 disabled:opacity-50 transition-all cursor-pointer shadow-2xs"
                                  >
                                    {savingInlineField === fieldKeyId ? "Saving…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingFieldKey(null)}
                                    className="px-2 py-1 rounded-md bg-white border border-border text-ink-muted text-[11px] font-semibold hover:bg-surface-muted transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={f.key}
                              className="flex items-center justify-between gap-3 text-xs p-2.5 rounded-lg bg-white border border-border/80 hover:border-border transition-colors group"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block">
                                  {f.label}
                                </span>
                                <span className="font-semibold text-ink truncate block">
                                  {f.value || <span className="text-red-500 italic text-[11px]">Missing</span>}
                                </span>
                              </div>
                              <div className="shrink-0 flex items-center gap-1.5">
                                {f.value && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingFieldKey(fieldKeyId);
                                      setEditingValue(f.value || "");
                                    }}
                                    title={`Edit ${f.label}`}
                                    className="p-1 text-ink-muted hover:text-brand hover:bg-surface-muted rounded-md transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {f.status === "HUMAN_CONFIRMED" || f.status === "HUMAN_CORRECTED" || f.status === "AUTO_VERIFIED" ? (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {f.status === "HUMAN_CORRECTED" ? "Corrected" : "Confirmed"}
                                  </span>
                                ) : f.status === "NOT_APPLICABLE" ? (
                                  <span className="text-[10px] font-bold text-ink-muted bg-surface-muted border border-border px-2 py-0.5 rounded-md flex items-center gap-1">
                                    Not applicable
                                  </span>
                                ) : f.status === "REJECTED" ? (
                                  <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    Rejected
                                  </span>
                                ) : f.status === "CONFLICT" ? (
                                  <span
                                    title="This value conflicts with another document. Resolve it from the Cross-document conflicts cards above."
                                    className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    Conflicting
                                  </span>
                                ) : f.value ? (
                                  <button
                                    type="button"
                                    onClick={() => handleInlineApprove(doc.documentId, f.key, f.value!)}
                                    disabled={fieldLoading || isBatchLoading}
                                    className="px-2.5 py-1 rounded-md bg-surface-muted hover:bg-emerald-50 border border-border hover:border-emerald-300 text-ink hover:text-emerald-700 text-[11px] font-semibold transition-all disabled:opacity-40 cursor-pointer"
                                  >
                                    {fieldLoading ? "Confirming…" : "Confirm ✓"}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingFieldKey(fieldKeyId);
                                      setEditingValue("");
                                    }}
                                    className="px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 text-[11px] font-semibold hover:bg-red-100 transition-all cursor-pointer"
                                  >
                                    Provide
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-ink-muted text-xs">
                No documents uploaded for field review yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* D-4: Request document email modal */}
      {requestingDocType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-brand" />
                </div>
                <h3 className="text-sm font-extrabold text-ink">Request Document</h3>
              </div>
              <button
                onClick={() => setRequestingDocType(null)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-surface-muted rounded-xl text-xs text-ink">
              <span className="font-semibold">{requestingDocType}</span> — a secure upload link valid for 7 days will be emailed to the recipient.
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-ink-muted flex items-center justify-between" htmlFor="request-email">
                <span>Recipient Email</span>
                {loadingCustomerUsers && <span className="text-brand flex items-center gap-1 font-normal"><Loader2 className="w-3 h-3 animate-spin" /> Loading customer contacts…</span>}
              </label>

              {/* Quick Select Dropdown for Existing Customer Users */}
              {customerUsersList.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] text-ink-muted font-medium">Select existing Customer Contact:</span>
                  <select
                    value={customerUsersList.some((u) => u.email === requestEmail) ? requestEmail : ""}
                    onChange={(e) => {
                      if (e.target.value) setRequestEmail(e.target.value);
                    }}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-border bg-surface-muted text-ink font-medium focus:outline-none focus:border-brand"
                  >
                    <option value="">-- Choose Existing Contact --</option>
                    {customerUsersList.map((user) => (
                      <option key={user.id} value={user.email}>
                        {user.name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Recipient Email Input with Datalist */}
              <div className="space-y-1">
                <input
                  id="request-email"
                  type="email"
                  list="customer-users-datalist"
                  value={requestEmail}
                  onChange={(e) => setRequestEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendDocumentRequest(); }}
                  placeholder="counterparty@example.com"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-white text-ink placeholder-ink-muted/60 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  autoFocus
                />
                <datalist id="customer-users-datalist">
                  {customerUsersList.map((user) => (
                    <option key={user.id} value={user.email}>
                      {user.name}
                    </option>
                  ))}
                </datalist>
              </div>

              {/* Auto-provisioning indicator */}
              {requestEmail.trim() && !customerUsersList.some((u) => u.email.toLowerCase() === requestEmail.trim().toLowerCase()) && (
                <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-medium flex items-center gap-1.5">
                  <span className="shrink-0 font-bold">✨ New Contact:</span>
                  <span>Will auto-create account, grant Customer User role & send request email.</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setRequestingDocType(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border text-ink-muted hover:bg-surface-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendDocumentRequest}
                disabled={!requestEmail.trim() || sendingRequest}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-brand text-white hover:bg-brand/90 disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {sendingRequest ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />Sending…</>
                ) : (
                  <><Mail className="w-3 h-3" />Send Request</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <ExceptionResolutionModal
        isOpen={!!selectedException}
        onClose={() => setSelectedException(null)}
        exception={selectedException}
        shipmentId={shipmentId}
        lineItems={lineItems}
      />

      <DocumentFieldReviewModal
        isOpen={!!reviewingDoc}
        onClose={() => setReviewingDoc(null)}
        shipmentId={shipmentId}
        summary={reviewingDoc}
      />

      {selectedPdfDoc && (
        <Modal
          isOpen={!!selectedPdfDoc}
          titleId="pdf-doc-viewer-modal-title"
          onClose={() => setSelectedPdfDoc(null)}
          size="xl"
        >
          <div className="p-0 min-h-[720px] h-[88vh] flex flex-col overflow-hidden">
            <DocumentReviewPanel
              documentId={selectedPdfDoc.documentId}
              fileName={selectedPdfDoc.fileName}
              proxyUrl={documentViewUrl(selectedPdfDoc.documentId)}
              onClose={() => setSelectedPdfDoc(null)}
              titleId="pdf-doc-viewer-modal-title"
            />
          </div>
        </Modal>
      )}
    </>
  );
}
