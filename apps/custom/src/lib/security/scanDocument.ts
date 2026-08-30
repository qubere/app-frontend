/**
 * Scan a document's bytes for malware and persist the verdict, before any
 * parsing / extraction touches the file.
 *
 * Idempotent: a document already CLEAN or SKIPPED is not re-scanned unless
 * `force` is set. A non-safe verdict (INFECTED or ERROR -- fail-closed)
 * quarantines the document: `malwareScanStatus` recorded, `status` set to
 * QUARANTINED, an audit row written, and a bell notification raised to the
 * people who can act on it. Callers must not proceed to parse when
 * `{ safe: false }` is returned.
 */

import { db } from "@/lib/db";
import { checksumOf } from "@/lib/storage";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { notifyAccountRoleHolders } from "@/modules/notifications/notifyAccount";
import { MalwareScanner } from "@/lib/security/malwareScanner";
import {
  scanForMalware,
  isSafeToProcess,
  type ClamavScanResult,
} from "@/lib/security/clamav";

export interface ScanDocumentResult {
  safe: boolean;
  result: ClamavScanResult;
  /** True when a scan actually ran this call (vs. a cached prior verdict). */
  scanned: boolean;
}

export async function scanDocumentForMalware(
  documentId: string,
  bytes: Buffer,
  opts: { sha256?: string; fileName?: string; force?: boolean } = {}
): Promise<ScanDocumentResult> {
  const doc = await db.shipmentDocument.findUnique({
    where: { id: documentId },
    select: { id: true, accountId: true, fileName: true, malwareScanStatus: true },
  });
  if (!doc) {
    return { safe: false, scanned: false, result: { status: "ERROR", detail: "document not found", scanner: "none" } };
  }

  if (!opts.force && (doc.malwareScanStatus === "CLEAN" || doc.malwareScanStatus === "SKIPPED")) {
    return {
      safe: true,
      scanned: false,
      result: { status: doc.malwareScanStatus, scanner: "cached" },
    };
  }

  const sha256 = opts.sha256 ?? checksumOf(bytes);
  const fileName = opts.fileName ?? doc.fileName;

  // Cheap in-process heuristics first (EICAR, double extension, exe magic
  // bytes) -- a hit here is a definite block and skips the network round trip.
  const heuristic = MalwareScanner.scan(bytes, fileName);
  const result: ClamavScanResult = heuristic.safe
    ? await scanForMalware({ bytes, sha256, fileName })
    : { status: "INFECTED", detail: heuristic.reason ?? heuristic.signature ?? "heuristic match", scanner: "heuristic" };
  const safe = isSafeToProcess(result.status);

  await db.shipmentDocument.update({
    where: { id: documentId },
    data: {
      malwareScanStatus: result.status,
      malwareScanDetail: result.detail ?? null,
      malwareScanAt: new Date(),
      ...(safe ? {} : { status: "QUARANTINED" }),
    },
  });

  await createAuditLog({
    accountId: doc.accountId,
    action: safe ? AuditAction.DOCUMENT_MALWARE_SCANNED : AuditAction.DOCUMENT_QUARANTINED,
    entity: "ShipmentDocument",
    entityId: documentId,
    source: "SYSTEM",
    metadata: { status: result.status, scanner: result.scanner, detail: result.detail ?? null },
  });

  if (!safe) {
    const reason =
      result.status === "INFECTED"
        ? `flagged as malware${result.detail ? ` (${result.detail})` : ""}`
        : "could not be virus-scanned";
    await notifyAccountRoleHolders({
      accountId: doc.accountId,
      type: "DOCUMENT_QUARANTINED",
      message: `"${doc.fileName}" was quarantined — ${reason}. It will not be processed.`,
      entityType: "ShipmentDocument",
      entityId: documentId,
      permission: "document.update",
      dedupe: true,
    }).catch(() => {});
  }

  return { safe, scanned: true, result };
}
