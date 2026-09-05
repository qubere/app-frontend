import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { listDisbursementAccounts, getOrCreateDisbursementAccount } from "@/modules/billing/funds/accountService";

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  if (!(await hasPermission("billing.funds.view"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.view required" }, { status: 403 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") || undefined;
  const importerId = url.searchParams.get("importerId") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const belowMinimum = url.searchParams.get("belowMinimum") === "true";
  const negative = url.searchParams.get("negative") === "true";

  const accounts = await listDisbursementAccounts(ctx.accountId, {
    clientId,
    importerId,
    status,
    belowMinimum,
    negative,
  });

  return NextResponse.json({ accounts });
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
    const account = await getOrCreateDisbursementAccount({
      accountId: ctx.accountId,
      clientId: body.clientId,
      importerId: body.importerId,
      currency: body.currency,
      minimumBalance: body.minimumBalance ? Number(body.minimumBalance) : 0,
      targetBalance: body.targetBalance ? Number(body.targetBalance) : 0,
      autoRequestReplenishment: Boolean(body.autoRequestReplenishment),
      autoAuthorizeUnder: body.autoAuthorizeUnder ? Number(body.autoAuthorizeUnder) : null,
    });
    return NextResponse.json({ account }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create account" }, { status: 400 });
  }
}, { write: true });
