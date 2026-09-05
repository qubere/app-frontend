import { db } from "@/lib/db";

export type AbiTransportProtocol = "AS2" | "MQ_SERIES" | "VPN_DIRECT" | "JSON_API" | "CSV";

export interface FilerHealthReport {
  filerCode: string;
  filerName: string;
  portCode: string | null;
  environment: string | null;
  credentialStatus: string | null;
  transportProtocol: AbiTransportProtocol | string;
  /** Delivered vs. total EntrySummary/filer exports in the trailing window. */
  exportsInWindow: number;
  failedExportsInWindow: number;
  /** Failed exports / total exports, as a percentage. 19 CFR 143.5 expects < 5%. */
  fatalErrorRatePct: number;
  isCompliantWith19Cfr143: boolean;
  connectionStatus: "HEALTHY" | "DEGRADED" | "DISCONNECTED" | "UNKNOWN";
  status: "HEALTHY" | "WARNING" | "NON_COMPLIANT";
  lastExportAt: string | null;
  lastError: string | null;
  windowDays: number;
}

const DEFAULT_WINDOW_DAYS = 30;

/**
 * Rolls the FilerExport delivery history + ABI credential state into a
 * 19 CFR 143 Subpart A health verdict for one filer code.
 *
 * "Fatal error rate" is the share of filer exports in the trailing window that
 * ended in `Failed`. Connection status is derived from the most recent export
 * outcome and the ABI credential's own status, not asserted.
 */
export async function getFilerAdminHealth(
  accountId: string,
  opts: { windowDays?: number } = {}
): Promise<FilerHealthReport | null> {
  const windowDays = opts.windowDays ?? DEFAULT_WINDOW_DAYS;
  const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);

  const [account, filerProfile, abiCredential] = await Promise.all([
    db.account.findUnique({ where: { id: accountId }, select: { name: true } }),
    db.filerProfile.findFirst({
      where: { accountId, active: true },
      select: { filerCode: true, defaultPortCode: true, transport: true },
      orderBy: { createdAt: "asc" },
    }),
    db.abiFilerCredential.findUnique({
      where: { accountId },
      select: { filerCode: true, environment: true, status: true },
    }),
  ]);

  const filerCode = filerProfile?.filerCode ?? abiCredential?.filerCode;
  if (!account || !filerCode) return null;

  const exports = await db.filerExport.findMany({
    where: { accountId, createdAt: { gte: since } },
    select: { status: true, lastError: true, createdAt: true, deliveredAt: true },
    orderBy: { createdAt: "desc" },
  });

  const total = exports.length;
  const failed = exports.filter((e) => e.status === "Failed").length;
  const fatalErrorRatePct = total > 0 ? Math.round((failed / total) * 1000) / 10 : 0;
  const isCompliant = fatalErrorRatePct <= 5.0;

  const mostRecent = exports[0] ?? null;
  let connectionStatus: FilerHealthReport["connectionStatus"] = "UNKNOWN";
  if (abiCredential && abiCredential.status !== "ACTIVE") {
    connectionStatus = "DISCONNECTED";
  } else if (mostRecent) {
    connectionStatus = mostRecent.status === "Failed" ? "DEGRADED" : "HEALTHY";
  }

  let status: FilerHealthReport["status"] = "HEALTHY";
  if (!isCompliant || connectionStatus === "DISCONNECTED") {
    status = "NON_COMPLIANT";
  } else if (fatalErrorRatePct > 3.0 || connectionStatus === "DEGRADED") {
    status = "WARNING";
  }

  return {
    filerCode,
    filerName: account.name,
    portCode: filerProfile?.defaultPortCode ?? null,
    environment: abiCredential?.environment ?? null,
    credentialStatus: abiCredential?.status ?? null,
    transportProtocol: (filerProfile?.transport as AbiTransportProtocol) ?? "AS2",
    exportsInWindow: total,
    failedExportsInWindow: failed,
    fatalErrorRatePct,
    isCompliantWith19Cfr143: isCompliant,
    connectionStatus,
    status,
    lastExportAt: (mostRecent?.deliveredAt ?? mostRecent?.createdAt)?.toISOString() ?? null,
    lastError: mostRecent?.lastError ?? null,
    windowDays,
  };
}
