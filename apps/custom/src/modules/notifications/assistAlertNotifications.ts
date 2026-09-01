import type { Prisma, Assist } from "@prisma/client";
import { db, runWithAccountId, runWithDataMode } from "@/lib/db";
import { Decimal } from "@/lib/tariff/decimal";
import { notifyAccountRoleHolders } from "./notifyAccount";
import { escapeHtml } from "@/modules/compliance/notifications/templates/escapeHtml";
import type { RenderedEmail } from "@/modules/compliance/notifications/templates/types";

export interface AssistAlert { assistId:string; description:string; currency:string; remainingValue:string; totalValue:string; warningEpoch:number }
export function computeAssistAlerts(assist: {id:string;description:string;currency:string;remainingValue:string;totalValue:string;warningEpoch:number}):AssistAlert[] {
  const remaining=new Decimal(assist.remainingValue),total=new Decimal(assist.totalValue);
  return total.gt(0)&&remaining.lt(total.times("0.1")) ? [{assistId:assist.id,description:assist.description,currency:assist.currency,remainingValue:assist.remainingValue,totalValue:assist.totalValue,warningEpoch:assist.warningEpoch}] : [];
}
export function assistAlertMessage(alert:AssistAlert) {
  return alert.description+": "+alert.currency+" "+alert.remainingValue+" remains of "+alert.totalValue+". Review the final entry allocations.";
}
export function renderAssistAlertEmail(value:unknown,appBaseUrl:string):RenderedEmail {
  const alert=value as AssistAlert;
  if(!alert || typeof alert.assistId!=="string" || typeof alert.description!=="string" || typeof alert.currency!=="string" || typeof alert.remainingValue!=="string" || typeof alert.totalValue!=="string")throw new Error("Invalid assist alert payload.");
  const message=assistAlertMessage(alert),url=new URL("/app/assists",appBaseUrl).toString();
  return {subject:"Assist nearing full amortization",text:message+"\n"+url,html:"<p>"+escapeHtml(message)+"</p><p><a href=\""+escapeHtml(url)+"\">Review assists</a></p>"};
}
export async function queueAssistAlert(tx:Prisma.TransactionClient,assist:Assist,remainingValue:string,filingId:string,operatorUserId:string) {
  const alert=computeAssistAlerts({...assist,totalValue:assist.totalValue.toString(),remainingValue})[0];
  if(!alert)return;
  const assistAlertKey=assist.accountId+":"+assist.id+":AMORTIZATION_WARNING:"+assist.warningEpoch;
  const filing=await tx.customsFiling.findFirst({where:{id:filingId,accountId:assist.accountId},select:{shipment:{select:{assignedBrokerId:true}}}});
  const brokerId=filing?.shipment?.assignedBrokerId??operatorUserId;
  const member=await tx.accountMembership.findFirst({where:{accountId:assist.accountId,userId:brokerId,status:"ACTIVE",deletedAt:null,user:{deletedAt:null}},select:{user:{select:{email:true}}}});
  const recipients=member?.user.email?[member.user.email]:[];
  await tx.complianceNotification.upsert({where:{assistAlertKey},update:{},create:{
    accountId:assist.accountId,notificationType:"ASSIST_AMORTIZATION_ALERT",assistAlertKey,recipients,
    payload:alert as unknown as Prisma.InputJsonValue,deliveryStatus:recipients.length?"PENDING":"SUPPRESSED",
    queuedAt:new Date(),lastErrorCode:recipients.length?null:"NO_ACTIVE_BROKER_RECIPIENT",
  }});
}
/** Durable queued alerts also drive the bell; repeating the cron does not re-notify. */
export async function notifyAssistAlerts(accountId:string) {
  const queued=await db.complianceNotification.findMany({where:{accountId,notificationType:"ASSIST_AMORTIZATION_ALERT",bellDeliveredAt:null},take:100,orderBy:{createdAt:"asc"}});
  let notified=0;
  for(const row of queued){
    const alert=row.payload as unknown as AssistAlert;
    const count=await notifyAccountRoleHolders({accountId,permission:"valuation.read",type:"ASSIST_AMORTIZATION_WARNING",
      message:assistAlertMessage(alert),entityType:"Assist",entityId:alert.assistId+":"+alert.warningEpoch,dedupe:true});
    const existing=count || await db.notification.count({where:{accountId,type:"ASSIST_AMORTIZATION_WARNING",entityType:"Assist",entityId:alert.assistId+":"+alert.warningEpoch}});
    if(existing){await db.complianceNotification.updateMany({where:{id:row.id,accountId,bellDeliveredAt:null},data:{bellDeliveredAt:new Date()}});notified+=count;}
  }
  return {notified};
}
export async function dispatchAssistBells() {
  return runWithDataMode(null,()=>runWithAccountId(null,async()=>{
    const rows=await db.complianceNotification.findMany({where:{notificationType:"ASSIST_AMORTIZATION_ALERT",bellDeliveredAt:null},select:{accountId:true},distinct:["accountId"],take:100});
    for(const row of rows)await runWithAccountId(row.accountId,()=>notifyAssistAlerts(row.accountId));
  }));
}
