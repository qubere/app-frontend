import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { db as prisma } from "@qubere/db";
import { createOrUpdateEstimatedDisbursement } from "@/modules/billing/funds/disbursementService";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!(await hasPermission("billing.funds.view"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.view required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const clientId = url.searchParams.get("clientId") || undefined;
  const shipmentId = url.searchParams.get("shipmentId") || undefined;
  const entryNumber = url.searchParams.get("entryNumber") || undefined;

  const where: any = { accountId: ctx.accountId };
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (shipmentId) where.shipmentId = shipmentId;
  if (entryNumber) where.entryNumber = entryNumber;

  const disbursements = await prisma.dutyDisbursement.findMany({
    where,
    include: {
      disbursementAccount: true,
      client: true,
      importer: true,
      feeLines: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ disbursements });
});

export const POST = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!(await hasPermission("billing.funds.manage"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.manage required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  try {
    const disbursement = await createOrUpdateEstimatedDisbursement({
      accountId: ctx.accountId,
      clientId: body.clientId,
      importerId: body.importerId,
      shipmentId: body.shipmentId,
      filingId: body.filingId,
      entryNumber: body.entryNumber,
      dutyAmount: Number(body.dutyAmount || 0),
      taxAmount: Number(body.taxAmount || 0),
      feeAmount: Number(body.feeAmount || 0),
      currency: body.currency,
      feeLines: body.feeLines,
    });
    return NextResponse.json({ disbursement }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create disbursement" }, { status: 400 });
  }
}, { write: true });
