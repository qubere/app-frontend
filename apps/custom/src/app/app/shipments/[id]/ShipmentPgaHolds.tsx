"use client";
import { useCallback, useEffect, useState } from "react";
import { workflowRequest } from "@/lib/brokerWorkflowClient";
import { PgaHoldResolutionDrawer } from "./PgaHoldResolutionDrawer";
import { AGENCIES } from "@/lib/pga/holdContracts";
type Hold = { id: string; agencyCode: string; status: string; reasonText: string };
export function ShipmentPgaHolds({ shipmentId, initialHoldId, canUpdate }: { shipmentId: string; initialHoldId?: string; canUpdate: boolean }) {
  const [holds, setHolds] = useState<Hold[]>([]);
  const [selected, setSelected] = useState(initialHoldId ?? null);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ agencyCode: "FDA", externalKey: "", holdCode: "", commodityLineRef: "", issuedAt: "", reasonText: "", rawNotice: "" });
  const refresh = useCallback(() => {
    workflowRequest<{ holds: Hold[] }>("/api/pga/holds?shipmentId=" + encodeURIComponent(shipmentId)).then(r => { setHolds(r.holds); setError(""); }).catch(e => setError(e.message));
  }, [shipmentId]);
  useEffect(refresh, [refresh]);
  const close = () => { setSelected(null); const u = new URL(window.location.href); u.searchParams.delete("pgaHold"); window.history.replaceState(null, "", u); refresh(); };
  return <section className="rounded-xl border border-border bg-white p-4" aria-label="Shipment agency holds">
    <div className="flex justify-between gap-3"><h2 className="font-semibold">Agency holds {holds.length ? "(" + holds.length + ")" : ""}</h2>{canUpdate && <button className="text-sm text-brand" onClick={() => setRecording(v => !v)}>Record agency notice</button>}</div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {!holds.length && !error && <p className="mt-2 text-sm text-ink-muted">No open agency holds recorded.</p>}
    <div className="mt-3 flex flex-wrap gap-2">{holds.map(h => <button key={h.id} title={h.reasonText} onClick={() => setSelected(h.id)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{h.agencyCode} · {h.status} →</button>)}</div>
    {recording && <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError("");
      try {
        const r = await workflowRequest<{hold: Hold}>("/api/pga/holds", {method:"POST",body:JSON.stringify({...form, shipmentId, issuedAt:new Date(form.issuedAt).toISOString(), commodityLineRef:form.commodityLineRef || undefined})});
        setRecording(false); refresh(); setSelected(r.hold.id);
      } catch(e) {setError(e instanceof Error ? e.message : "Please retry.");} finally{setBusy(false);}
    }}>
      <p className="text-xs text-ink-muted sm:col-span-2">Record an actual agency notice. Screening warnings are separate and must not be recorded as issued holds.</p>
      <label className="text-sm">Agency<select className="mt-1 w-full rounded-lg border border-border p-2" value={form.agencyCode} onChange={e => setForm(v => ({...v,agencyCode:e.target.value}))}>{[...AGENCIES,"TTB","BATFE","OFAC"].map(a=><option key={a}>{a}</option>)}</select></label>
      {(["externalKey","holdCode","commodityLineRef","issuedAt","reasonText","rawNotice"] as const).map(key => <label key={key} className="text-sm">{{externalKey:"Source notice reference",holdCode:"Hold reason code",commodityLineRef:"Commodity line (optional)",issuedAt:"Issued at",reasonText:"Agency explanation",rawNotice:"Original notice text"}[key]}<input className="mt-1 w-full rounded-lg border border-border p-2" type={key === "issuedAt" ? "datetime-local":"text"} required={key !== "commodityLineRef"} value={form[key]} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/></label>)}
      <button disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-40">Save notice</button>
    </form>}
    {selected && <PgaHoldResolutionDrawer key={selected} id={selected} onClose={close} onChanged={refresh}/>}
  </section>;
}
