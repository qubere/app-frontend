"use client";

import { useCallback, useRef, useState } from "react";
import { caughtMessage } from "@/lib/utils";

export type DecisionAction = "APPROVE" | "REJECT" | "RE_EVALUATE";

export function useDecisionActions(
  onStatusChange: (decisionId: string, newStatus: string) => void
) {
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const reviewStartedAt = useRef(new Map<string, number>());

  const markDecisionOpened = useCallback((decisionId: string) => {
    if (!reviewStartedAt.current.has(decisionId)) reviewStartedAt.current.set(decisionId, Date.now());
  }, []);

  const runDecisionAction = async (
    decisionId: string,
    action: DecisionAction,
    humanNotes?: string
  ): Promise<boolean> => {
    setActionLoadingId(decisionId);
    const newStatus =
      action === "APPROVE" ? "Approved" : action === "REJECT" ? "Rejected" : "In Progress";

    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decisionId,
          action,
          humanNotes,
          processingDurationMs: Math.max(0, Date.now() - (reviewStartedAt.current.get(decisionId) ?? Date.now())),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Action failed");
      onStatusChange(decisionId, newStatus);
      reviewStartedAt.current.delete(decisionId);
      return true;
    } catch (err) {
      alert(`Action failed: ${caughtMessage(err, String(err))}`);
      return false;
    } finally {
      setActionLoadingId(null);
    }
  };

  return { actionLoadingId, runDecisionAction, markDecisionOpened };
}
