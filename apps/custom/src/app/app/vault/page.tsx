import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";
import { VaultClient } from "./VaultClient";

export default async function VaultPage() {
  const ctx = await getAccountContext();
  if (!ctx) {
    return null;
  }

  const accountId = ctx.accountId;

  return withDataModeContext(isDataMode(ctx.dataMode) ? ctx.dataMode : null, async () => {
    const [oppsRaw, claimsRaw, lotsRaw, filingsRaw] = await Promise.all([
      db.refundOpportunity.findMany({
        where: { accountId },
        include: {
          filing: {
            select: { entryNumber: true },
          },
        },
        orderBy: { identifiedAt: "desc" },
      }),
      db.drawbackClaim.findMany({
        where: { accountId },
        include: {
          matches: {
            include: {
              shipmentLineItem: true,
              exportLineItem: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.drawbackLot.findMany({
        where: { accountId },
        orderBy: { exportDeadline: "asc" },
      }),
      db.customsFiling.findMany({
        where: {
          accountId,
          filingStatus: { in: ["Accepted", "Closed"] },
        },
        include: { snapshot: true },
      }),
    ]);

    const formattedOpps = oppsRaw.map((o: any) => ({
      id: o.id,
      opportunityType: o.opportunityType,
      estimatedRefundAmount: o.estimatedRefundAmount ? Number(o.estimatedRefundAmount) : 0,
      confidence: o.confidence,
      status: o.status,
      filingEntryNumber: o.filing?.entryNumber ?? "",
    }));

    const formattedLots = lotsRaw.map((l) => ({
      id: l.id,
      entryNumber: l.entryNumber,
      htsCode: l.htsCode,
      quantity: Number(l.quantity),
      availableQty: Number(l.availableQty),
      dutyPaidPerUnit: Number(l.dutyPaidPerUnit),
      exportDeadline: l.exportDeadline ? l.exportDeadline.toISOString().split("T")[0] : "",
      hasSection301: l.hasSection301,
      section301List: l.section301List,
    }));

    // Section 301 Stats
    let totalEntries = 0;
    let totalDutyPaid = new Decimal(0);
    const byListMap = new Map<string, { entries: number; dutyPaid: Decimal }>();
    const LISTS = ["List1", "List2", "List3", "List4A", "List4B", "Unknown"];
    for (const list of LISTS) {
      byListMap.set(list, { entries: 0, dutyPaid: new Decimal(0) });
    }

    for (const filing of filingsRaw) {
      if (filing.snapshot && filing.snapshot.hasSection301) {
        totalEntries++;
        const duty = new Decimal(filing.totalDuties || 0);
        totalDutyPaid = totalDutyPaid.plus(duty);

        const listName = filing.snapshot.section301List || "Unknown";
        const current = byListMap.get(listName) || { entries: 0, dutyPaid: new Decimal(0) };
        byListMap.set(listName, {
          entries: current.entries + 1,
          dutyPaid: current.dutyPaid.plus(duty),
        });
      }
    }

    const byList = Array.from(byListMap.entries()).map(([list, data]) => ({
      list,
      entries: data.entries,
      dutyPaid: data.dutyPaid.toNumber(),
    }));

    const initialSection301Data = {
      totalEntries,
      totalDutyPaid: totalDutyPaid.toNumber(),
      byList,
    };

    const initialClaims = JSON.parse(JSON.stringify(claimsRaw));

    return (
      <VaultClient
        initialOpportunities={formattedOpps}
        initialClaims={initialClaims}
        initialLots={formattedLots}
        initialSection301Data={initialSection301Data}
      />
    );
  });
}

