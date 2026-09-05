"use client";

// Client-side helper functions calling API endpoints with error handling and path revalidation
export async function createDisbursementAccountAction(data: {
  clientId: string;
  importerId?: string;
  minimumBalance?: number;
  targetBalance?: number;
  autoRequestReplenishment?: boolean;
}) {
  const res = await fetch("/api/billing/funds/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to create account");
  return json.account;
}

export async function recordDepositAction(
  accountId: string,
  data: {
    amount: number;
    referenceNo?: string;
    notes?: string;
    replenishmentRequestId?: string;
  }
) {
  const res = await fetch(`/api/billing/funds/accounts/${accountId}/deposits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to record deposit");
  return json.entry;
}

export async function recordRefundAction(
  accountId: string,
  data: {
    amount: number;
    reason: string;
  }
) {
  const res = await fetch(`/api/billing/funds/accounts/${accountId}/refunds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to record refund");
  return json.entry;
}

export async function recordAdjustmentAction(
  accountId: string,
  data: {
    amount: number;
    reason: string;
  }
) {
  const res = await fetch(`/api/billing/funds/accounts/${accountId}/adjustments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to record adjustment");
  return json.entry;
}

export async function markDisbursementPaidAction(
  disbursementId: string,
  data: {
    actualAmount: number;
    paidAt?: string;
    cbpPaymentRef?: string;
    paymentMethod?: string;
  }
) {
  const res = await fetch(`/api/billing/funds/disbursements/${disbursementId}/mark-paid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to mark disbursement paid");
  return json.disbursement;
}

export async function resolveReconciliationLineAction(
  reconId: string,
  lineId: string,
  action: "ACCEPT" | "ADJUST" | "EXCEPTION" | "RELINK",
  adjustmentAmount?: number
) {
  const res = await fetch(`/api/billing/funds/reconciliations/${reconId}/lines/${lineId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, adjustmentAmount }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Failed to resolve line");
  return json.line;
}
