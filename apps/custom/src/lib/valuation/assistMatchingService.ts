import { createHash } from "crypto";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/api/error";
import { Decimal } from "@/lib/tariff/decimal";
import { ExchangeRateService } from "@/modules/fx/exchangeRateService";
import { calculateAssistAllocation } from "./assistAllocation";
import { expireAssists } from "./assistRegistryService";
import type { Prisma } from "@prisma/client";

type Scope = { suppliers: { partyId: string; role: string }[]; hts: { prefix: string }[]; skuPattern: string | null };
export function assistLineMatches(scope: Scope, line: { htsCode: string; partNumber: string | null }, parties: { partyId: string; role: string }[]) {
  const hts = line.htsCode.replace(/\./g, "");
  const htsMatch = scope.hts.some(s => hts.startsWith(s.prefix));
  const pattern = scope.skuPattern;
  const skuMatch = !!pattern && !!line.partNumber && (pattern.endsWith("*") ? line.partNumber.startsWith(pattern.slice(0, -1)) : line.partNumber === pattern);
  if (!htsMatch && !skuMatch) return false;
  if (!scope.suppliers.length) return false;
  return ["SUPPLIER", "MANUFACTURER"].every(role => {
    const configured = scope.suppliers.filter(s => s.role === role);
    return !configured.length || configured.some(s => parties.some(p => p.role === role && p.partyId === s.partyId));
  });
}
function normalizeRole(role: string) {
  const r = role.toUpperCase();
  if (["SUPPLIER", "SELLER", "S"].includes(r)) return "SUPPLIER";
  if (["MANUFACTURER", "M"].includes(r)) return "MANUFACTURER";
  return r;
}
export async function getAssistMatches(accountId: string, filingId: string, client: Prisma.TransactionClient = db) {
  const filing = await client.customsFiling.findFirst({
    where: { id: filingId, accountId },
    include: { shipment: { include: {
      lineItems: { where: { accountId }, include: { product: { include: { parties: { where: { accountId, status: "ACTIVE" }, include: { legalEntity: { select: { partyId: true, accountId: true } } } } } } }, orderBy: { lineNumber: "asc" } },
      shipmentParties: { where: { legalEntity: { accountId } }, include: { legalEntity: { select: { partyId: true } } } },
    } } },
  });
  if (!filing) throw new DomainError("Filing not found.", "NOT_FOUND", 404);
  const decisions = await client.assistDecision.findMany({ where: { accountId, filingId } });
  const declarations = await client.assistDeclaration.findMany({ where: { accountId, filingId } });
  const shipment = filing.shipment;
  if (!shipment || shipment.accountId !== accountId || shipment.deletedAt) return { matches: [], staleDecisions: decisions.filter(d=>d.decision !== "Dismiss"), declarations, filing };
  const importerId = filing.importerOfRecordId ?? shipment.importerOfRecordId;
  if (!importerId) return { matches: [], staleDecisions: decisions.filter(d=>d.decision !== "Dismiss"), declarations, filing };
  if (client === db) await expireAssists(accountId);
  const now = new Date();
  const assists = await client.assist.findMany({
    where: { accountId, importerOfRecordId: importerId, status: "Active", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
    include: { suppliers: true, hts: true, _count: { select: { declarations: true } } },
    orderBy: { id: "asc" },
  });
  const globalParties = shipment.shipmentParties.filter(p=>p.legalEntity.partyId).map(p=>({partyId:p.legalEntity.partyId!, role:normalizeRole(p.role)}));
  const stored = filing.dutyBreakdown && !Array.isArray(filing.dutyBreakdown) ? filing.dutyBreakdown as Record<string, Prisma.JsonValue> : {};
  const currency = stored.currencyContext && typeof stored.currencyContext === "object" && !Array.isArray(stored.currencyContext) ? stored.currencyContext as Record<string, Prisma.JsonValue> : {};
  const commercialCurrency = String(currency.commercialCurrency ?? shipment.invoiceCurrency ?? "USD");
  const customsCurrency = String(currency.customsCurrency ?? "USD");
  const rateDate = shipment.ladingDate ?? now;
  const rateCache = new Map<string, Promise<Decimal>>();
  const rate = (code: string) => {
    if (!rateCache.has(code)) rateCache.set(code, (async () => {
      if (code === "USD") return new Decimal(1);
      if (code === commercialCurrency && currency.exchangeRate && customsCurrency === "USD") {
        const value = new Decimal(String(currency.exchangeRate));
        if (!value.isFinite() || value.lte(0)) throw new Error("A positive declared exchange rate is required.");
        return value;
      }
      return new Decimal((await ExchangeRateService.resolveExchangeRate(code, rateDate)).toString());
    })());
    return rateCache.get(code)!;
  };
  const matches: AssistMatch[] = [];
  for (const assist of assists) {
    if (declarations.some(d => d.assistId === assist.id)) continue;
    const lines = shipment.lineItems.filter(line => {
      const productParties = line.product?.accountId === accountId ? line.product.parties
        .filter(p => p.legalEntity.accountId === accountId && p.legalEntity.partyId && p.effectiveFrom <= now && (!p.effectiveTo || p.effectiveTo >= now))
        .map(p => ({ partyId: p.legalEntity.partyId!, role: normalizeRole(p.role) })) : [];
      return assistLineMatches(assist, line, [...globalParties, ...productParties]);
    });
    if (!lines.length) continue;
    let amount: string | null = null;
    let exchangeRate: string | null = null;
    let blockedReason: string | null = null;
    try {
      if ((filing.country ?? shipment.destinationCountry ?? "US") !== "US" || customsCurrency !== "USD") throw new Error("Assist declarations currently support US entries valued in USD.");
      const assistRate = await rate(assist.currency);
      const invoiceRate = await rate(commercialCurrency);
      exchangeRate = assistRate.toFixed(12);
      const fob = lines.reduce((sum,line)=>sum.plus(line.totalValue.toString()),new Decimal(0)).times(invoiceRate).div(assistRate);
      amount = calculateAssistAllocation({ ...assist, totalValue: assist.totalValue.toString(), remainingValue: assist.remainingValue.toString(), estimatedVolume: assist.estimatedVolume?.toString(), estimatedImportValue: assist.estimatedImportValue?.toString() },
        { units: lines.reduce((sum,line)=>sum+line.quantity,0), fobValue:fob, declaredCount:assist._count.declarations }).toFixed(2);
    } catch (error) { blockedReason = error instanceof Error ? error.message : "Allocation is unavailable."; }
    const lineData = lines.map(l=>({id:l.id,lineNumber:l.lineNumber,description:l.description,quantity:l.quantity,totalValue:l.totalValue.toString(),htsCode:l.htsCode,updatedAt:l.updatedAt.toISOString()}));
    const basisHash = createHash("sha256").update(JSON.stringify({ filingId, filingVersion:filing.version, importerId, assistId:assist.id, assistVersion:assist.version, amount, exchangeRate, currency:commercialCurrency, lines:lineData })).digest("hex");
    const decision = decisions.find(d=>d.assistId === assist.id);
    matches.push({ id:assist.id, description:assist.description, currency:assist.currency, remainingValue:assist.remainingValue.toString(), allocationMethod:assist.allocationMethod,
      amount, exchangeRate, blockedReason, basisHash, assistVersion:assist.version, lines:lineData,
      decision:decision ? { kind:decision.decision, amount:decision.amount.toString(), current:decision.basisHash === basisHash, overrideReasonCode:decision.overrideReasonCode } : null });
  }
  return { matches, staleDecisions:decisions.filter(d=>d.decision !== "Dismiss" && !matches.some(m=>m.id === d.assistId) && !declarations.some(x=>x.assistId === d.assistId)), declarations, filing };
}
export interface AssistMatch {
  id: string; description: string; currency: string; remainingValue: string; allocationMethod: string;
  amount: string | null; exchangeRate: string | null; blockedReason: string | null; basisHash: string; assistVersion: number;
  lines: { id: string; lineNumber: number; description: string; quantity: number; totalValue: string; htsCode: string; updatedAt: string }[];
  decision: { kind: string; amount: string; current: boolean; overrideReasonCode: string | null } | null;
}
