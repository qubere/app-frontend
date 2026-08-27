import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { assembleReasonableCarePackage } from "@/lib/audit/reasonableCarePackage";
import { createSignedReadUrl, storeGeneratedFile } from "@/lib/storage";

export const POST = withAuthenticatedRoute(async ({ ctx }) => {
  // Task E-2: Access control: only OWNER role on the account can trigger this export
  const isOwner = ctx.roleNames.includes("OWNER");
  if (!isOwner) {
    return NextResponse.json({ error: "Access denied. Only account owners can generate portable compliance exports." },
      { status: 403 }
    );
  }

  // 1. Fetch Product Master with classification history
  const products = await db.product.findMany({
    where: { accountId: ctx.accountId },
    include: {
      compositions: true,
      countryFacts: true,
    },
});

  // 2. Fetch all reasonable care records
  const shipments = await db.shipment.findMany({
    where: { accountId: ctx.accountId },
    select: { id: true, shipmentNumber: true },
  });

  const reasonableCareRecords = [];
  for (const s of shipments) {
    const pkg = await assembleReasonableCarePackage(ctx.accountId, s.id);
    if (pkg) {
      reasonableCareRecords.push(pkg);
    }
  }

  // 3. Fetch Audit Logs scoped to importer
  const auditLogs = await db.auditLog.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // 4. Generate MANIFEST.json
  const manifest = {
    exporter: ctx.accountName,
    exportedAt: new Date().toISOString(),
    contents: {
      productMaster: {
        recordsCount: products.length,
        description: "Authoritative product classifications, material compositions, and origin facts.",
      },
      reasonableCarePackages: {
        recordsCount: reasonableCareRecords.length,
        description: "Shipment-level audit defense packages documenting classification, valuation, and rules-of-origin compliance.",
      },
      auditTrail: {
        recordsCount: auditLogs.length,
        description: "Append-only system mutation trail and verification history.",
      },
    },
  };

  const exportPayload = {
    manifest,
    products,
    reasonableCareRecords,
    auditLogs,
  };

  // Log audit event
  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "PORTABLE_COMPLIANCE_RECORD_EXPORTED",
    entity: "Account",
    entityId: ctx.accountId,
    source: "UI",
    metadata: {
      productsCount: products.length,
      packagesCount: reasonableCareRecords.length,
    },
  });

  let downloadUrl = "";
  try {
    const filename = `compliance-exports/export-${ctx.accountId}-${Date.now()}.json`;
    const stored = await storeGeneratedFile({
      objectPath: filename,
      filename: filename.split("/").pop() ?? "compliance-export.json",
      contentType: "application/json",
      body: Buffer.from(JSON.stringify(exportPayload, null, 2)),
    });
    downloadUrl = await createSignedReadUrl(
      stored.url,
      new Date(Date.now() + 15 * 60 * 1000)
    );
  } catch (err) {
    console.error("Failed to upload compliance export:", err);
    return NextResponse.json(
      { error: "Failed to upload compliance export artifact to object storage." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    manifest,
    downloadUrl,
    exportPayload,
  });

}, { permission: "audits.read", write: true });
