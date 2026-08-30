/**
 * Account-scoped loaders for the Today compliance + billing lanes.
 *
 * The caller owns account auth and the dataMode context wrapper (every model
 * here carries an Account relation and is dataMode-scoped). This module only
 * queries and shapes -- see todayLanes.ts for the pure layer.
 */

import { db } from "@/lib/db";
import {
  billingExceptionToItem,
  reviewFindingToItem,
  screeningFindingToItem,
  summarizeLane,
  type TodayLaneItem,
  type TodayLaneSummary,
} from "./todayLanes";

const ROW_CAP = 300; // per source -- Today is a triage view, not a report

/** ComplianceFinding statuses that still need a human. */
const REVIEW_FINDING_OPEN = ["Open", "Investigating"];

export async function loadComplianceLane(accountId: string): Promise<TodayLaneSummary> {
  const [reviewFindings, screeningFindings] = await Promise.all([
    db.complianceFinding.findMany({
      where: { accountId, status: { in: REVIEW_FINDING_OPEN } },
      select: {
        id: true,
        rule: true,
        severity: true,
        description: true,
        status: true,
        createdAt: true,
        filing: {
          select: {
            id: true,
            entryNumber: true,
            shipment: {
              select: { id: true, shipmentNumber: true, client: { select: { id: true, name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP,
    }),
    db.complianceScreeningFinding.findMany({
      where: { accountId, status: "OPEN" },
      select: {
        id: true,
        category: true,
        ruleName: true,
        severity: true,
        details: true,
        status: true,
        createdAt: true,
        shipment: {
          select: { id: true, shipmentNumber: true, client: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: ROW_CAP,
    }),
  ]);

  const items: TodayLaneItem[] = [
    ...reviewFindings.map(reviewFindingToItem),
    ...screeningFindings.map(screeningFindingToItem),
  ];

  return summarizeLane("compliance", items);
}

export async function loadBillingLane(accountId: string): Promise<TodayLaneSummary> {
  const exceptions = await db.billingException.findMany({
    where: { accountId, status: "OPEN" },
    select: {
      id: true,
      type: true,
      severity: true,
      description: true,
      status: true,
      createdAt: true,
      shipment: { select: { id: true, shipmentNumber: true } },
      client: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: ROW_CAP,
  });

  return summarizeLane("billing", exceptions.map(billingExceptionToItem));
}

export interface TodayLaneCounts {
  operations: number;
  compliance: number;
  billing: number;
  total: number;
}

/**
 * Lightweight counts for the sidebar "Today" badge. `operationsCount` is passed
 * in because the Operations queue is assembled from several sources the caller
 * already holds; recomputing it here would double the query cost.
 */
export async function loadTodayLaneCounts(
  accountId: string,
  operationsCount: number
): Promise<TodayLaneCounts> {
  const [reviewFindings, screeningFindings, billingExceptions] = await Promise.all([
    db.complianceFinding.count({ where: { accountId, status: { in: REVIEW_FINDING_OPEN } } }),
    db.complianceScreeningFinding.count({ where: { accountId, status: "OPEN" } }),
    db.billingException.count({ where: { accountId, status: "OPEN" } }),
  ]);

  const compliance = reviewFindings + screeningFindings;
  const billing = billingExceptions;
  return {
    operations: operationsCount,
    compliance,
    billing,
    total: operationsCount + compliance + billing,
  };
}
