import { withPortalAccount } from "@/lib/portal-scope";
import { NextResponse } from "next/server";
import { authorizePortalResource } from "@qubere/auth";
import { generateForm7501PdfBuffer, type Form7501FieldResult, type Form7501LineItem, type Form7501Result } from "@qubere/billing/form7501";
import { db } from "@qubere/db";

type SnapshotLineItem = {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  totalValue: number;
  customsValue?: number;
  htsCode: string;
  countryOfOrigin: string;
};

type SnapshotData = {
  lineItems?: SnapshotLineItem[];
  filingHeader?: { totalValue?: number; totalDuties?: number };
};

function field<T>(block: string, label: string, value: T | null, sourced: boolean): Form7501FieldResult<T> {
  return {
    block,
    label,
    value,
    status: value === null || value === undefined || String(value).trim() === "" ? "missing" : sourced ? "sourced_approved" : "sourced_unapproved",
    provenance: { value, sourceModel: "FilingSnapshot", sourceId: null, sourceField: label },
  };
}

export const GET = withPortalAccount(async (ctx, req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const filing = await db.customsFiling.findUnique({
    where: { id, accountId: ctx.accountId },
    select: {
      id: true,
      entryNumber: true,
      entryType: true,
      accountId: true,
      customerVisibleAt: true,
      importerOfRecord: { select: { name: true, cbpImporterNumber: true } },
      bond: { select: { bondNumber: true } },
      snapshot: { select: { snapshotData: true } },
      shipment: {
        select: {
          clientId: true,
          importerName: true,
          portOfEntry: true,
          carrierName: true,
          countryOfExport: true,
          lineItems: {
            orderBy: { lineNumber: "asc" },
            select: { id: true, lineNumber: true, description: true, quantity: true, totalValue: true, htsCode: true, countryOfOrigin: true },
          },
        },
      },
    },
  });

  if (!filing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const auth = await authorizePortalResource({
    permission: "portal.entries.download",
    resourceAccountId: filing.accountId,
    resourceClientId: filing.shipment?.clientId,
    customerVisibleAt: filing.customerVisibleAt,
  });

  if (!auth.authorized || auth.errorResponse || !auth.ctx) {
    return auth.errorResponse || NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Audit PDF download
  await db.auditLog.create({
    data: {
      accountId: filing.accountId,
      userId: auth.ctx.userId,
      actorUserId: auth.ctx.userId,
      effectiveUserId: auth.ctx.userId,
      action: "CUSTOMER_PORTAL_ENTRY_SUMMARY_DOWNLOAD",
      entity: "CustomsFiling",
      entityId: filing.id,
      clientId: filing.shipment?.clientId,
      newValue: { entryNumber: filing.entryNumber },
      source: "PORTAL_UI",
    },
  });

  // Entries are only customer-visible once transmitted, so the frozen FilingSnapshot
  // is the authoritative source for entered values. Per-line duty rate/amount are not
  // stored per-line in the snapshot (only the entry-level total), so those columns are
  // left blank here rather than recomputed — the portal has no access to the tariff
  // duty engine (Section 301/232, AD/CVD resolution) that produced the original figures.
  const snapshot = filing.snapshot?.snapshotData as unknown as SnapshotData | undefined;
  const snapshotLines = snapshot?.lineItems;
  const liveLines = filing.shipment?.lineItems ?? [];

  const lineItems: Form7501LineItem[] = (snapshotLines ?? liveLines).map((li, idx) => ({
    lineNumber: "lineNumber" in li ? li.lineNumber : idx + 1,
    description: field("28", "Description of Merchandise", li.description ?? null, true),
    htsCode: field("33", "HTS Number", li.htsCode ?? null, true),
    enteredValue: field("29", "Entered Value", Number(("customsValue" in li ? li.customsValue : undefined) ?? li.totalValue ?? 0), true),
    dutyRate: field<number>("34", "Duty Rate", null, false),
    dutyAmount: field<number>("35", "Duty Amount", null, false),
    countryOfOrigin: field("10", "Country of Origin", li.countryOfOrigin ?? null, true),
    quantity: field("27", "Quantity", Number(li.quantity), true),
  }));

  const totalEnteredValue =
    snapshot?.filingHeader?.totalValue ??
    lineItems.reduce((sum, li) => sum + (li.enteredValue.value ?? 0), 0);
  const totalDuty = snapshot?.filingHeader?.totalDuties ?? null;

  const form7501: Form7501Result = {
    entryType: field("1", "Entry Type", filing.entryType, true),
    entryNumber: field("2", "Entry Number", filing.entryNumber, true),
    portCode: field("45", "Port of Entry", filing.shipment?.portOfEntry ?? null, true),
    importerName: field("25", "Importer of Record", filing.importerOfRecord?.name ?? filing.shipment?.importerName ?? null, true),
    importerNumber: field("23", "Importer Number", filing.importerOfRecord?.cbpImporterNumber ?? null, !!filing.importerOfRecord?.cbpImporterNumber),
    bondNumber: field("4", "Bond Number", filing.bond?.bondNumber ?? null, !!filing.bond?.bondNumber),
    countryOfExport: field("14", "Country of Export", filing.shipment?.countryOfExport ?? null, true),
    carrier: field("8", "Importing Carrier", filing.shipment?.carrierName ?? null, true),
    totalEnteredValue: field("40", "Total Entered Value", totalEnteredValue, true),
    totalDuty: field("43", "Total Duty", totalDuty, totalDuty !== null),
    lineItems,
    generatedAt: new Date().toISOString(),
    htsReleaseId: null,
    coverageStatus: { required: 0, sourced: 0, approved: 0, missing: 0 },
  };

  const pdfBuffer = generateForm7501PdfBuffer(form7501);

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="CBP-Form-7501-${filing.entryNumber}.pdf"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
