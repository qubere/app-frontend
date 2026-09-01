import { queueAssistAlert } from "@/modules/notifications/assistAlertNotifications";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/api/error";
import { createAuditLog, AuditAction } from "@/lib/audit";
import { Decimal, roundToCents } from "@/lib/tariff/decimal";
import { getAssistMatches } from "./assistMatchingService";
import { getAssist, assistConflict } from "./assistRegistryService";
import { apportionAssistToLines, addAssistToCustomsValue } from "./assistAllocation";
import type { z } from "zod";
import type { assistDecisionSchema } from "./assistContracts";
import type { TariffLineInput } from "@/lib/tariff/dutyEngine";

const EDITABLE = ["Draft", "Preparing", "ValidationFailed", "ReadyForBrokerReview", "BrokerApproved", "Rejected"];
export async function saveAssistDecision(accountId: string, userId: string, id: string, input: z.infer<typeof assistDecisionSchema>, dismiss: boolean) {
  await getAssist(accountId, id);
  const result = await getAssistMatches(accountId, input.filingId);
  if (!EDITABLE.includes(result.filing.filingStatus)) throw new DomainError("This filing can no longer be edited.", "FILING_LOCKED", 409);
  if (result.declarations.some(d=>d.assistId === id)) throw new DomainError("Submitted declarations are immutable.", "ASSIST_DECLARED", 409);
  const match = result.matches.find(m=>m.id === id);
  if (!dismiss && (!match || match.blockedReason || match.amount === null || !match.exchangeRate)) throw new DomainError(match?.blockedReason ?? "This assist no longer applies to the entry.", "ASSIST_NOT_APPLICABLE", 422);
  if (!dismiss && (match!.basisHash !== input.basisHash || match!.assistVersion !== input.assistVersion)) throw assistConflict();
  const amount = new Decimal(dismiss ? "0" : input.amount ?? match!.amount!);
  if (!dismiss && (amount.lte(0) || amount.gt(match!.remainingValue))) throw new DomainError("The amount must be positive and cannot exceed the remaining balance.", "INVALID_ASSIST_AMOUNT", 422);
  if (input.amount !== undefined && !input.overrideReasonCode && !dismiss) throw new DomainError("An override requires a reason.", "OVERRIDE_REASON_REQUIRED", 422);
  const kind = dismiss ? "Dismiss" : input.amount !== undefined ? "Override" : "Include";
  const fx = new Decimal(match?.exchangeRate ?? "1");
  const data = { decision:kind, amount:amount.toFixed(2), customsAmount:roundToCents(amount.times(fx)).toFixed(2), exchangeRate:fx.toFixed(12), basisHash:match?.basisHash ?? input.basisHash,
    assistVersion:match?.assistVersion ?? input.assistVersion, overrideReasonCode:input.overrideReasonCode ?? null, operatorUserId:userId };
  await db.$transaction(async tx => {
    const locked = await tx.customsFiling.updateMany({ where:{ id:input.filingId,accountId,version:result.filing.version,filingStatus:{in:EDITABLE}}, data:{ updatedAt:new Date() } });
    if (!locked.count) throw assistConflict();
    await tx.assistDecision.upsert({ where:{assistId_filingId:{assistId:id,filingId:input.filingId}},create:{...data,accountId,assistId:id,filingId:input.filingId},update:data });
  },{isolationLevel:"Serializable"});
  await createAuditLog({ accountId,userId,action:dismiss?AuditAction.ASSIST_DISMISSED:AuditAction.ASSIST_CONFIRMED,entity:"CustomsFiling",entityId:input.filingId,source:"UI",metadata:{assistId:id,decision:kind,amount:data.amount,overrideReasonCode:data.overrideReasonCode,staged:true} });
  return { staged:true,decision:kind,message:dismiss?"Non-inclusion recorded.":"Included for the next submission. The ledger balance has not changed." };
}

/** Prepared against current data, then checked again in the publication transaction. */
export async function prepareAssistDeclarations(accountId:string,filingId:string) {
  const result = await getAssistMatches(accountId,filingId);
  if(result.staleDecisions.length) throw assistConflict();
  const decisions=await db.assistDecision.findMany({where:{accountId,filingId}});
  const pending=[];
  for(const match of result.matches){
    const decision=decisions.find(d=>d.assistId===match.id);
    if(!decision || decision.decision==="Dismiss") continue;
    if(decision.basisHash!==match.basisHash || decision.assistVersion!==match.assistVersion || match.blockedReason || !match.exchangeRate) throw assistConflict();
    const amount = new Decimal(decision.amount.toString());
    if(amount.lte(0)||amount.gt(match.remainingValue)) throw assistConflict();
    const customsAmount=roundToCents(amount.times(match.exchangeRate));
    if(customsAmount.lte(0)) throw new DomainError("The converted assist amount rounds to zero.", "INVALID_ASSIST_AMOUNT",422);
    const lineAmounts=apportionAssistToLines(customsAmount,match.lines.map(l=>({id:l.id,value:l.totalValue,quantity:l.quantity})));
    pending.push({assistId:match.id,version:match.assistVersion,basisHash:match.basisHash,decisionId:decision.id,decisionUpdatedAt:decision.updatedAt,
      amount:amount.toFixed(2),customsAmount:customsAmount.toFixed(2),currency:match.currency,exchangeRate:match.exchangeRate,lineAmounts,
      wasOverride:decision.decision==="Override",overrideReasonCode:decision.overrideReasonCode,operatorUserId:decision.operatorUserId});
  }
  return { pending, existing:result.declarations, matches:result.matches, filingVersion:result.filing.version };
}
export type PreparedAssists=Awaited<ReturnType<typeof prepareAssistDeclarations>>;

export function applyAssistAmountsToTariffLines<T extends TariffLineInput & {id?:string}>(lines:T[],prepared:PreparedAssists) {
  const additions=new Map<string,Decimal>();
  for(const row of [...prepared.pending,...prepared.existing]){
    const allocations=row.lineAmounts as {lineId:string;amount:string}[];
    for(const item of allocations) additions.set(item.lineId,(additions.get(item.lineId)??new Decimal(0)).plus(item.amount));
  }
  for(const id of additions.keys()) if(!lines.some(l=>l.id===id)) throw new DomainError("A declared assist line was removed. A post-entry correction is required.", "ASSIST_LINE_REMOVED",409);
  return lines.map(line=>{
    const addition=line.id?additions.get(line.id):undefined;
    return addition ? {...line,totalValue:addAssistToCustomsValue(String(line.totalValue??0),addition,"USD")} : line;
  });
}
/** Runs in the SAME transaction as FilingMessage, filing state, and snapshot. */
export async function commitAssistDeclarations(tx:Prisma.TransactionClient,accountId:string,filingId:string,prepared:PreparedAssists) {
  const created=[];
  for(const item of prepared.pending){
    const existing=await tx.assistDeclaration.findFirst({where:{accountId,assistId:item.assistId,filingId}});
    if(existing) continue;
    const decision=await tx.assistDecision.findFirst({where:{id:item.decisionId,accountId,filingId,basisHash:item.basisHash,updatedAt:item.decisionUpdatedAt,decision:{in:["Include","Override"]}}});
    if(!decision) throw assistConflict();
    const assist=await tx.assist.findFirst({where:{id:item.assistId,accountId,status:"Active",version:item.version}});
    if(!assist || assist.effectiveFrom>new Date() || (assist.effectiveTo && assist.effectiveTo<new Date())) throw assistConflict();
    const remaining=new Decimal(assist.remainingValue.toString()).minus(item.amount);
    if(remaining.lt(0)) throw assistConflict();
    const update=await tx.assist.updateMany({where:{id:item.assistId,accountId,version:item.version,status:"Active",remainingValue:{gte:item.amount}},
      data:{remainingValue:remaining.toFixed(2),version:{increment:1},status:remaining.isZero()?"Amortized":"Active"}});
    if(update.count!==1) throw assistConflict();
    const declaration=await tx.assistDeclaration.create({data:{
      accountId,assistId:item.assistId,filingId,amountDeclared:item.amount,customsAmount:item.customsAmount,currency:item.currency,customsCurrency:"USD",
      exchangeRate:item.exchangeRate,lineAmounts:item.lineAmounts,wasOverride:item.wasOverride,overrideReasonCode:item.overrideReasonCode,operatorUserId:item.operatorUserId,
    }});
    created.push(declaration);
    await queueAssistAlert(tx, assist, remaining.toFixed(2), filingId, item.operatorUserId);
    await tx.auditLog.create({data:{accountId,userId:item.operatorUserId,action:AuditAction.ASSIST_DECLARED,entity:"CustomsFiling",entityId:filingId,source:"UI",
      metadata:{assistId:item.assistId,declarationId:declaration.id,amount:item.amount,customsAmount:item.customsAmount,overrideReasonCode:item.overrideReasonCode}}});
    if(remaining.isZero()) await tx.auditLog.create({data:{accountId,action:AuditAction.ASSIST_AMORTIZED,entity:"Assist",entityId:item.assistId,source:"SYSTEM"}});
  }
  // Reconcile the existing valuation record without dropping agent-discovered assists.
  if(created.length){
    const declarations=await tx.assistDeclaration.findMany({where:{accountId,filingId}});
    const record=await tx.valuationAssistsRecord.findFirst({where:{accountId,filingId}});
    const previous=Array.isArray(record?.potentialAssists)?record!.potentialAssists as Prisma.JsonObject[]:[];
    const merged=[...previous.filter(a=>!a.registryAssistId),...declarations.map(d=>({registryAssistId:d.assistId,assistType:"registry",estimatedValue:d.customsAmount.toString(),declared:true,amount:d.customsAmount.toString(),currency:d.customsCurrency}))];
    const filing=await tx.customsFiling.findFirst({where:{id:filingId,accountId}});
    await tx.valuationAssistsRecord.upsert({where:{filingId},create:{accountId,filingId,declaredValue:filing?.totalValue??0,potentialAssists:merged},update:{declaredValue:filing?.totalValue??0,potentialAssists:merged}});
  }
  return created;
}

export async function assertAssistPublicationContext(tx: Prisma.TransactionClient, accountId: string, filingId: string, prepared: PreparedAssists) {
  const fresh = await getAssistMatches(accountId, filingId, tx);
  if (fresh.filing.version !== prepared.filingVersion || fresh.staleDecisions.length) throw assistConflict();
  const decisions = await tx.assistDecision.findMany({ where: { accountId, filingId, decision: { in: ["Include", "Override"] } } });
  const existingIds = new Set(prepared.existing.map(d=>d.assistId));
  const selected = decisions.filter(d=>!existingIds.has(d.assistId));
  if (selected.length !== prepared.pending.length) throw assistConflict();
  for (const item of prepared.pending) {
    const match = fresh.matches.find(m=>m.id===item.assistId);
    const decision = selected.find(d=>d.id===item.decisionId);
    if (!match || match.basisHash!==item.basisHash || !decision || decision.updatedAt.getTime()!==item.decisionUpdatedAt.getTime()) throw assistConflict();
  }
}
