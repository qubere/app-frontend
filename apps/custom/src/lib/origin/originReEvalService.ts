import { db, runWithAccountId } from "@/lib/db";
import { determineOrigin } from "@/lib/origin/originEngine";
import { createAuditLog, AuditAction } from "@/lib/audit";

export async function reevaluateProductLineItems(productId: string, accountId: string) {
  return runWithAccountId(accountId, async () => {
    return _reevaluateProductLineItems(productId, accountId);
  });
}

async function _reevaluateProductLineItems(productId: string, accountId: string) {
  const lineItems = await db.shipmentLineItem.findMany({
    where: { productId, accountId },
    include: {
      product: {
        include: { compositions: true },
      },
      origins: { include: { tradeAgreement: true } },
    },
  });

  let updatedCount = 0;
  for (const lineItem of lineItems) {
    const tradeAgreementCode = lineItem.origins[0]?.tradeAgreement.code;
    const result = determineOrigin({
      product: {
        id: lineItem.productId ?? undefined,
        htsCode: lineItem.htsCode,
        description: lineItem.description,
        price: Number(lineItem.totalValue),
      },
      materials: lineItem.product?.compositions.map((c) => ({
        id: c.id,
        name: c.material,
        cost: c.percentage ? Number(c.percentage) : null,
      })) ?? [],
      claimedCountry: lineItem.countryOfOrigin,
      tradeAgreementCode,
    });

    if (lineItem.origins.length > 0) {
      const before = lineItem.origins[0];
      const changed =
        before.qualifies !== result.qualifies ||
        before.criterion !== result.basis ||
        Number(before.regionalValueContentPct ?? null) !== Number(result.regionalValueContentPct ?? null);

      await db.originDetermination.update({
        where: { id: before.id },
        data: {
          qualifies: result.qualifies,
          criterion: result.basis,
          regionalValueContentPct: result.regionalValueContentPct ?? null,
        },
      });
      updatedCount++;

      if (changed) {
        await createAuditLog({
          accountId,
          action: AuditAction.ORIGIN_DETERMINED,
          entity: "OriginDetermination",
          entityId: before.id,
          source: "SYSTEM",
          metadata: {
            productId,
            shipmentLineItemId: lineItem.id,
            tradeAgreementCode,
          },
          beforeJson: {
            qualifies: before.qualifies,
            criterion: before.criterion,
            regionalValueContentPct: before.regionalValueContentPct,
          },
          afterJson: {
            qualifies: result.qualifies,
            criterion: result.basis,
            regionalValueContentPct: result.regionalValueContentPct ?? null,
          },
        });
      }
    }
  }

  return { evaluatedLineItems: lineItems.length, updatedDeterminations: updatedCount };
}
