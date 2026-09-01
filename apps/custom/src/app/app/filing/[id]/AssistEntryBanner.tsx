"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { workflowRequest, WorkflowRequestError } from "@/lib/brokerWorkflowClient";
import { OVERRIDE_REASONS } from "@/lib/valuation/assistContracts";
type Match={id:string;description:string;currency:string;remainingValue:string;amount:string|null;blockedReason:string|null;basisHash:string;assistVersion:number;lines:{id:string;lineNumber:number}[];decision:{kind:string;amount:string;current:boolean}|null};
type Data={matches:Match[];staleDecisions:{assistId:string;basisHash:string;assistVersion:number}[];declarations:{id:string;amountDeclared:string;currency:string}[];canUpdate:boolean;canOverride:boolean;filingStatus:string};
export function AssistEntryBanner({filingId,revision}:{filingId:string;revision:string}){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [busy,setBusy]=useState<string|null>(null),[overrides,setOverrides]=useState<Record<string,{amount:string;reason:string}>>({}),[conflicts,setConflicts]=useState<Record<string,number>>({});
  const load=useCallback(async()=>{setData(await workflowRequest<Data>("/api/assists/matches?filingId="+encodeURIComponent(filingId)));},[filingId]);
  useEffect(()=>{void load().catch(e=>setError(e.message));},[load,revision]);
  const act=async(id:string,basisHash:string,assistVersion:number,dismiss=false)=>{
    if(busy)return;setBusy(id);setError("");setNotice("");
    try{
      const override=overrides[id];
      await workflowRequest("/api/assists/"+id+(dismiss?"/dismiss":"/declare"),{method:"POST",body:JSON.stringify({filingId,basisHash,assistVersion,...(!dismiss&&override?{amount:override.amount,overrideReasonCode:override.reason}:{})})});
      await load();setConflicts(v=>({...v,[id]:0}));setNotice(dismiss?"Non-inclusion recorded.":"Included for submission. The balance changes when the entry is submitted.");
    }catch(e){
      if(e instanceof WorkflowRequestError&&e.status===409){const count=(conflicts[id]??0)+1;setConflicts(v=>({...v,[id]:count}));await load().catch(()=>{});
        setError(count===1?"The entry or balance changed. Review the refreshed amount and confirm again.":"This assist changed again. Refresh and coordinate with the other broker before confirming.");
      }else setError(e instanceof Error?e.message:"Please retry.");
    }finally{setBusy(null);}
  };
  if(!data&&!error)return null;
  if(data&&!data.matches.length&&!data.staleDecisions.length&&!data.declarations.length&&!error)return null;
  const locked=!!data&&!["Draft","Preparing","ValidationFailed","ReadyForBrokerReview","BrokerApproved","Rejected"].includes(data.filingStatus);
  return <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4" aria-label="Entry assists">
    {error&&<p role="alert" className="mb-3 text-sm text-amber-900">{error}</p>}{notice&&<p role="status" className="mb-3 text-sm text-green-800">{notice}</p>}
    <details open={!!data?.staleDecisions.length}>
      <summary className="cursor-pointer text-sm font-semibold">{data?.matches.length??0} active assists apply to this entry{data?.declarations.length?" · "+data.declarations.length+" declared":""}</summary>
      <p className="mt-2 text-xs text-ink-muted">Confirm additions before submitting. Unconfirmed assists are not included.</p>
      {data?.staleDecisions.map(d=><div key={d.assistId} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm"><p>A selected assist no longer applies. Remove its inclusion before submitting.</p>{data.canUpdate&&!locked&&<button className="mt-2 text-brand" disabled={!!busy} onClick={()=>void act(d.assistId,d.basisHash,d.assistVersion,true)}>Remove inclusion</button>}</div>)}
      {data?.matches.map(m=><div key={m.id} className="mt-3 rounded-xl border border-border bg-white p-4">
        <div className="flex flex-wrap justify-between gap-3"><div><Link href="/app/assists" className="text-sm font-semibold text-brand">{m.description}</Link><p className="mt-1 text-xs text-ink-muted">Remaining {m.currency} {m.remainingValue} · Lines {m.lines.map(l=>l.lineNumber).join(", ")}</p></div><strong className="text-sm">{m.amount===null?"Allocation unavailable":m.currency+" "+m.amount}</strong></div>
        {m.blockedReason&&<p className="mt-2 text-sm text-amber-800">{m.blockedReason}</p>}
        {m.decision&&<p className="mt-2 text-xs text-ink-muted">{m.decision.current?m.decision.kind+" · "+m.currency+" "+m.decision.amount:"Previous decision is stale; review the current amount."}</p>}
        {data.canUpdate&&!locked&&<div className="mt-3 flex flex-wrap gap-3 text-sm">
          <button disabled={!!busy||!!m.blockedReason||!m.amount||Number(m.amount)<=0||(conflicts[m.id]??0)>1||!!(overrides[m.id]&&!overrides[m.id].reason)} onClick={()=>void act(m.id,m.basisHash,m.assistVersion)} className="rounded-lg bg-brand px-3 py-1.5 text-white disabled:opacity-40">Include</button>
          {data.canOverride&&<button className="text-brand" onClick={()=>setOverrides(v=>({...v,[m.id]:{amount:m.amount??"",reason:""}}))}>Override</button>}
          <button disabled={!!busy} onClick={()=>void act(m.id,m.basisHash,m.assistVersion,true)} className="text-ink-muted">Do not include</button>
        </div>}
        {overrides[m.id]&&data.canOverride&&data.canUpdate&&!locked&&<div className="mt-3 flex flex-wrap gap-2">
          <label className="text-xs">Amount ({m.currency})<input className="ml-2 w-28 rounded-lg border border-border p-2" inputMode="decimal" value={overrides[m.id].amount} onChange={e=>setOverrides(v=>({...v,[m.id]:{...v[m.id],amount:e.target.value}}))}/></label>
          <label className="text-xs">Reason<select className="ml-2 rounded-lg border border-border p-2" value={overrides[m.id].reason} onChange={e=>setOverrides(v=>({...v,[m.id]:{...v[m.id],reason:e.target.value}}))}><option value="">Choose a reason</option>{OVERRIDE_REASONS.map(r=><option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></label>
        </div>}
      </div>)}
      {data?.declarations.map(d=><p key={d.id} className="mt-3 text-sm">Declared: {d.currency} {d.amountDeclared} · immutable audit record</p>)}
    </details>
    <button className="mt-3 text-xs text-brand" onClick={()=>{setConflicts({});setError("");void load().catch(e=>setError(e.message));}}>Refresh assist review</button>
  </section>;
}
