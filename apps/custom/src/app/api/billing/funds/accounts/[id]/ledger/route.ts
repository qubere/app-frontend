import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { hasPermission } from "@/lib/auth";
import { getAccountLedger } from "@/modules/billing/funds/ledgerService";

export const GET = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params }) => {
  if (!(await hasPermission("billing.funds.view"))) {
    return NextResponse.json({ error: "Forbidden: billing.funds.view required" }, { status: 403 });
  }

  const { id } = await params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || undefined;
  const format = url.searchParams.get("format");
  // A CSV export is a full statement — never silently truncate it to one page.
  const limit = format === "csv" ? 100_000 : url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : 50;
  const offset = format === "csv" ? 0 : url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : 0;

  const { total, entries } = await getAccountLedger(ctx.accountId, id, { limit, offset, type });

  if (format === "csv") {
    const csvCell = (v: string) => {
      const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const header = "Date,Type,Description,Amount,Running Balance,Currency,ID\n";
    const rows = entries
      .map(
        (e) =>
          `${csvCell(e.effectiveAt.toISOString())},${csvCell(e.type)},${csvCell(e.description)},${e.amount.toString()},${e.runningBalance.toString()},${csvCell(e.currency)},${csvCell(e.id)}`
      )
      .join("\n");
    return new NextResponse(header + rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ledger-${id}.csv"`,
      },
    });
  }

  return NextResponse.json({ total, entries });
});
