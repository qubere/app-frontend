"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { workflowRequest } from "@/lib/brokerWorkflowClient";
import { ASSIST_TYPES, ALLOCATION_METHODS, type AssistInput } from "@/lib/valuation/assistContracts";
import { calculateAssistAllocation } from "@/lib/valuation/assistAllocation";

type Assist=Omit<AssistInput,"hts"|"suppliers">&{id:string;version:number;remainingValue:string;status:string;createdAt:string;importerOfRecord:{id:string;name:string}|null;hts:{prefix:string}[];suppliers:{partyId:string;role:"SUPPLIER"|"MANUFACTURER";party?:{names:{rawName:string}[]}}[]};
type Options={importers:{id:string;name:string}[];parties:{id:string;name:string}[]};
type History={assist:Assist;declarations:{id:string;amountDeclared:string;currency:string;filingId:string;declaredAt:string;wasOverride:boolean;overrideReasonCode:string|null;filing:{entryNumber:string}}[];total:number;page:number};
const inputClass="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm";
const labels:Record<string,string>={lump_sum:"Lump sum",equal_allocation:"Equal allocation",value_proportional:"Value proportional"};
const money=(value:string,currency:string)=>{try{return new Intl.NumberFormat(undefined,{style:"currency",currency}).format(Number(value));}catch{return currency+" "+value;}};
const fresh=():AssistInput=>({type:"tooling",description:"",importerOfRecordId:null,totalValue:"",currency:"USD",allocationMethod:"lump_sum",allocationBasis:"entries",estimatedVolume:null,estimatedImportValue:null,skuPattern:null,suppliers:[],hts:[],effectiveFrom:new Date().toISOString(),effectiveTo:null});
export function AssistRegistry({canUpdate,supplierId,manufacturerId}:{canUpdate:boolean;supplierId?:string;manufacturerId?:string}){
  const [data,setData]=useState<{assists:Assist[];total:number}>({assists:[],total:0}),[options,setOptions]=useState<Options>({importers:[],parties:[]});
  const [status,setStatus]=useState(""),[importer,setImporter]=useState(""),[page,setPage]=useState(0),[error,setError]=useState("");
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[editing,setEditing]=useState<Assist|null>(null),[open,setOpen]=useState(canUpdate && !!(supplierId||manufacturerId));
  const [form,setForm]=useState<AssistInput>(()=>({...fresh(),suppliers:[...(supplierId?[{partyId:supplierId,role:"SUPPLIER" as const}]:[]),...(manufacturerId?[{partyId:manufacturerId,role:"MANUFACTURER" as const}]:[])]}));
  const [htsText,setHtsText]=useState(""),[partySearch,setPartySearch]=useState(""),[exampleValue,setExampleValue]=useState("1000"),[history,setHistory]=useState<History|null>(null);
  const load=useCallback(async()=>{
    const q=new URLSearchParams({page:String(page)});if(status)q.set("status",status);if(importer)q.set("importerId",importer);
    setData(await workflowRequest("/api/assists?"+q));setLoading(false);
  },[page,status,importer]);
  useEffect(()=>{void load().catch(e=>{setError(e.message);setLoading(false);});},[load]);
  useEffect(()=>{
    let active=true;const timer=setTimeout(()=>{workflowRequest<Options>("/api/assists/options?q="+encodeURIComponent(partySearch)).then(o=>{if(active)setOptions(prev=>({importers:partySearch?prev.importers:o.importers,parties:[...o.parties,...prev.parties.filter(p=>form.suppliers.some(s=>s.partyId===p.id)&&!o.parties.some(x=>x.id===p.id))]}));}).catch(e=>{if(active)setError(e.message);});},200);
    return()=>{active=false;clearTimeout(timer);};
  },[partySearch,form.suppliers]);
  useEffect(()=>{
    const id=supplierId??manufacturerId;
    if(id)void workflowRequest<Options>("/api/assists/options?partyId="+encodeURIComponent(id)).then(o=>setOptions(prev=>({...prev,parties:[...prev.parties.filter(p=>!o.parties.some(x=>x.id===p.id)),...o.parties]}))).catch(e=>setError(e.message));
  },[supplierId,manufacturerId]);
  const preview=useMemo(()=>{
    try{return money(calculateAssistAllocation({...form,totalValue:form.totalValue||"0",remainingValue:form.totalValue||"0"},{units:1,fobValue:exampleValue||"0"}).toFixed(2),form.currency);}catch{return "Enter allocation inputs";}
  },[form,exampleValue]);
  const run=async(fn:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Please retry.");}finally{setBusy(false);}};
  const start=(assist?:Assist)=>{
    setEditing(assist??null);
    setForm(assist?{type:assist.type,description:assist.description,importerOfRecordId:assist.importerOfRecordId,totalValue:assist.totalValue,currency:assist.currency,allocationMethod:assist.allocationMethod,allocationBasis:assist.allocationBasis,estimatedVolume:assist.estimatedVolume,estimatedImportValue:assist.estimatedImportValue,skuPattern:assist.skuPattern,suppliers:assist.suppliers.map(({partyId,role})=>({partyId,role})),hts:assist.hts.map(h=>h.prefix),effectiveFrom:assist.effectiveFrom,effectiveTo:assist.effectiveTo}:fresh());
    setHtsText(assist?.hts.map(h=>h.prefix).join(", ")??"");setOpen(true);
    if(assist)setOptions(prev=>({...prev,parties:[...prev.parties,...assist.suppliers.filter(p=>!prev.parties.some(x=>x.id===p.partyId)).map(p=>({id:p.partyId,name:p.party?.names[0]?.rawName??p.partyId}))]}));
  };
  const save=()=>run(async()=>{
    const input={...form,hts:htsText.split(/[,\s]+/).map(s=>s.replace(/\./g,"")).filter(Boolean)};
    await workflowRequest(editing?"/api/assists/"+editing.id:"/api/assists",{method:editing?"PATCH":"POST",body:JSON.stringify(editing?{version:editing.version,action:"edit",input}:input)});
    setOpen(false);await load();
  });
  return <main className="mx-auto max-w-6xl space-y-6 pb-12">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand">Compliance</p><h1 className="mt-1 text-2xl font-semibold text-ink">Assists</h1><p className="mt-2 text-sm text-ink-muted">One balance across entries. Review the addition, then declare with the filing.</p></div>{canUpdate&&<button onClick={()=>start()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">+ Add assist</button>}</header>
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <div className="flex flex-wrap gap-3"><label className="text-sm">Status<select className={inputClass} value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">All statuses</option>{["Draft","Active","Suspended","Amortized"].map(s=><option key={s}>{s}</option>)}</select></label><label className="text-sm">Importer<select className={inputClass} value={importer} onChange={e=>{setImporter(e.target.value);setPage(0);}}><option value="">All importers</option>{options.importers.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label><button onClick={()=>void run(load)} className="self-end px-3 py-2 text-sm text-brand">Refresh</button></div>
    {loading?<p role="status">Loading assists…</p>:!data.assists.length?<div className="rounded-2xl border border-dashed border-border p-10 text-center"><h2 className="font-medium">No assists in this view</h2><p className="mt-2 text-sm text-ink-muted">Register buyer-provided costs. Drafts stay inactive until you activate them.</p></div>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.assists.map(assist=>{
      const declared=Number(assist.totalValue)-Number(assist.remainingValue),progress=100*declared/Number(assist.totalValue);
      return <article key={assist.id} className={"rounded-2xl border border-border bg-white p-5 shadow-2xs "+(assist.status==="Amortized"?"opacity-75":"")}>
        <div className="flex items-start justify-between gap-3"><h2 className="font-semibold text-ink">{assist.description}</h2><span className={"rounded-full px-2 py-1 text-xs "+(assist.status==="Active"?"bg-green-50 text-green-800":"bg-gray-100 text-gray-700")}>{assist.status}</span></div>
        <p className="mt-2 text-sm text-ink-muted">{assist.importerOfRecord?.name??"Importer not set"} · {assist.type}</p>
        <p className="mt-4 text-2xl font-semibold">{money(assist.remainingValue,assist.currency)}<span className="ml-1 text-xs font-normal text-ink-muted">remaining</span></p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-label="Assist amortized" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand" style={{width:Math.max(0,Math.min(100,progress))+"%"}}/></div>
        <p className="mt-2 text-xs text-ink-muted">{money(declared.toFixed(2),assist.currency)} declared of {money(assist.totalValue,assist.currency)}</p><p className="mt-3 text-sm">{labels[assist.allocationMethod]}</p><p className="mt-1 text-xs text-ink-muted">HTS: {assist.hts.map(h=>h.prefix).join(", ")||"—"}{assist.skuPattern?" · SKU "+assist.skuPattern:""}</p>
        <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-3 text-sm"><button className="text-brand" onClick={()=>void run(async()=>setHistory(await workflowRequest<History>("/api/assists/"+assist.id)))}>History</button>
          {canUpdate&&assist.status!=="Amortized"&&<>{assist.status!=="Active"&&<button className="text-brand" onClick={()=>start(assist)}>Edit</button>}<button disabled={busy} className="font-medium text-brand disabled:opacity-40" onClick={()=>void run(async()=>{await workflowRequest("/api/assists/"+assist.id,{method:"PATCH",body:JSON.stringify({version:assist.version,action:assist.status==="Draft"?"activate":assist.status==="Active"?"suspend":"reactivate"})});await load();})}>{assist.status==="Draft"?"Activate":assist.status==="Active"?"Suspend":"Reactivate"}</button></>}
        </div>
      </article>;
    })}</div>}
    {data.total>24&&<div className="flex justify-end gap-4 text-sm"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page+1} of {Math.ceil(data.total/24)}</span><button disabled={(page+1)*24>=data.total} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
    <DrawerShell open={open} title={editing?"Edit assist":"Register assist"} busy={busy} onClose={()=>setOpen(false)} footer={<div className="flex justify-between gap-3"><button onClick={()=>setOpen(false)} disabled={busy} className="text-sm">Cancel</button><button disabled={busy||!form.description||!form.totalValue} onClick={()=>void save()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{editing?"Save changes":"Save draft"}</button></div>}>
      {error&&<p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="space-y-4"><p className="text-sm text-ink-muted">Drafts do not affect entries. Activate after reviewing scope and allocation.</p>
        <label className="block text-sm">Description<input className={inputClass} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Type<select className={inputClass} value={form.type} onChange={e=>setForm(v=>({...v,type:e.target.value as AssistInput["type"]}))}>{ASSIST_TYPES.map(t=><option key={t}>{t}</option>)}</select></label>
          <label className="text-sm">Importer<select className={inputClass} value={form.importerOfRecordId??""} onChange={e=>setForm(v=>({...v,importerOfRecordId:e.target.value||null}))}><option value="">Choose before activation</option>{options.importers.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></label>
          <label className="text-sm">Total value<input inputMode="decimal" className={inputClass} value={form.totalValue} onChange={e=>setForm(v=>({...v,totalValue:e.target.value}))}/></label><label className="text-sm">Currency<input maxLength={3} className={inputClass} value={form.currency} onChange={e=>setForm(v=>({...v,currency:e.target.value.toUpperCase()}))}/></label>
        </div>
        <label className="block text-sm">Find supplier / manufacturer<input className={inputClass} value={partySearch} onChange={e=>setPartySearch(e.target.value)} placeholder="Search party name"/></label>
        <div className="grid gap-4 sm:grid-cols-2">{(["SUPPLIER","MANUFACTURER"] as const).map(role=><label key={role} className="text-sm">{role==="SUPPLIER"?"Suppliers":"Manufacturers"}<select multiple className={inputClass+" min-h-28"} value={form.suppliers.filter(p=>p.role===role).map(p=>p.partyId)} onChange={e=>{const ids=Array.from(e.target.selectedOptions).map(o=>o.value);setForm(v=>({...v,suppliers:[...v.suppliers.filter(p=>p.role!==role),...ids.map(partyId=>({partyId,role}))]}));}}>{options.parties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>)}</div>
        <label className="block text-sm">HTS prefixes<input className={inputClass} placeholder="e.g. 8480, 3926" value={htsText} onChange={e=>setHtsText(e.target.value)}/><span className="text-xs text-ink-muted">4, 6, 8, or 10 digits, separated by commas.</span></label><label className="block text-sm">SKU pattern (optional)<input className={inputClass} value={form.skuPattern??""} onChange={e=>setForm(v=>({...v,skuPattern:e.target.value||null}))} placeholder="Exact SKU or prefix*"/></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Effective from<input type="date" className={inputClass} value={form.effectiveFrom.slice(0,10)} onChange={e=>setForm(v=>({...v,effectiveFrom:e.target.value?e.target.value+"T00:00:00.000Z":""}))}/></label><label className="text-sm">Effective to (optional)<input type="date" className={inputClass} value={form.effectiveTo?.slice(0,10)??""} onChange={e=>setForm(v=>({...v,effectiveTo:e.target.value?e.target.value+"T23:59:59.999Z":null}))}/></label></div>
        <fieldset><legend className="text-sm font-medium">Allocation method</legend><div className="mt-2 grid grid-cols-3 gap-2">{ALLOCATION_METHODS.map(method=><button type="button" key={method} aria-pressed={form.allocationMethod===method} onClick={()=>setForm(v=>({...v,allocationMethod:method}))} className={"rounded-lg border p-2 text-xs "+(form.allocationMethod===method?"border-brand bg-blue-50 text-brand":"border-border")}>{labels[method]}</button>)}</div></fieldset>
        {form.allocationMethod==="equal_allocation"&&<div className="grid grid-cols-2 gap-3"><label className="text-sm">Estimated volume<input inputMode="decimal" className={inputClass} value={form.estimatedVolume??""} onChange={e=>setForm(v=>({...v,estimatedVolume:e.target.value||null}))}/></label><label className="text-sm">Allocate by<select className={inputClass} value={form.allocationBasis} onChange={e=>setForm(v=>({...v,allocationBasis:e.target.value as "entries"|"units"}))}><option value="entries">Entry count</option><option value="units">Units</option></select></label></div>}
        {form.allocationMethod==="value_proportional"&&<div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Estimated imports ({form.currency})<input className={inputClass} value={form.estimatedImportValue??""} onChange={e=>setForm(v=>({...v,estimatedImportValue:e.target.value||null}))}/></label><label className="text-sm">Example FOB ({form.currency})<input className={inputClass} value={exampleValue} onChange={e=>setExampleValue(e.target.value)}/></label></div>}
        <div className="rounded-xl bg-blue-50 p-4" role="status"><p className="text-xs text-blue-800">Preview {form.allocationBasis==="units"&&form.allocationMethod==="equal_allocation"?"per unit":form.allocationMethod==="value_proportional"?"for example FOB":"for next entry"}</p><p className="mt-1 text-xl font-semibold text-blue-900">{preview}</p><p className="mt-2 text-xs text-blue-800">Actual amounts are capped at the remaining balance and confirmed on the entry.</p></div>
      </div>
    </DrawerShell>
    <DrawerShell open={!!history} title="Assist declaration history" onClose={()=>setHistory(null)}>
      {history&&<div className="space-y-4"><h3 className="font-semibold">{history.assist.description}</h3><p className="text-sm">Remaining: {money(history.assist.remainingValue,history.assist.currency)}</p>{!history.declarations.length&&<p className="text-sm text-ink-muted">No submitted declarations. Confirming an inclusion does not spend the balance.</p>}{history.declarations.map(d=><div key={d.id} className="rounded-lg border border-border p-3 text-sm"><Link className="font-medium text-brand" href={"/app/filing/"+d.filingId}>{d.filing.entryNumber}</Link><p>{money(d.amountDeclared,d.currency)} · {new Date(d.declaredAt).toLocaleString()}</p>{d.wasOverride&&<p className="text-xs text-ink-muted">Override: {d.overrideReasonCode}</p>}</div>)}{history.total>50&&<div className="flex gap-4"><button disabled={history.page===0} onClick={()=>void run(async()=>setHistory(await workflowRequest<History>("/api/assists/"+history.assist.id+"?page="+(history.page-1))))}>Previous</button><button disabled={(history.page+1)*50>=history.total} onClick={()=>void run(async()=>setHistory(await workflowRequest<History>("/api/assists/"+history.assist.id+"?page="+(history.page+1))))}>Next</button></div>}</div>}
    </DrawerShell>
  </main>;
}
