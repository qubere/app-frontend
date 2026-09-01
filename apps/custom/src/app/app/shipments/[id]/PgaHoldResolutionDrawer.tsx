"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DrawerShell } from "@/components/ui/DrawerShell";
import { workflowRequest, WorkflowRequestError } from "@/lib/brokerWorkflowClient";
import { validatePreparation, type HoldFormInput, type PreparationField } from "@/lib/pga/holdContracts";

type Submission = { id: string; status: string; transmissionMode: string; externalReference: string; submittedAt: string; rejectionCode: string | null; rejectionReason: string | null; rejectedFields: string[] | null; messageSetText: string };
type Detail = {
  hold: { id: string; agencyCode: string; holdCode: string; status: string; issuedAt: string; rawNotice: string; version: number; shipment?: { shipmentNumber: string }; submissions: Submission[] };
  submissionTotal: number;
  formInput: HoldFormInput; prefill: HoldFormInput; staleDraft: boolean; explanation: string; fields: PreparationField[] | null;
  permissions: { canUpdate: boolean; canApprove: boolean }; transport: { reason: string };
};
const control = "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink disabled:bg-gray-50";
export function PgaHoldResolutionDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<HoldFormInput>({});
  const formRef = useRef<HoldFormInput>({});
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const [step, setStep] = useState(0);
  const [olderSubmissions, setOlderSubmissions] = useState<Submission[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState<Detail | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [externalReference, setExternalReference] = useState("");
  const [messageText, setMessageText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const requestKey = useRef<string | null>(null);
  const [response, setResponse] = useState({ status: "Processing", responseCode: "", reason: "", rawResponse: "", rejectedFields: "", responseAt: "" });
  const load = useCallback(async () => {
    const result = await workflowRequest<Detail>("/api/pga/holds/" + id);
    setOlderSubmissions([]); setHistoryPage(1);
    setDetail(result); setForm(result.formInput); formRef.current = result.formInput;
    versionRef.current = result.hold.version; dirtyRef.current = false;
    return result;
  }, [id]);
  useEffect(() => {
    let active = true;
    workflowRequest<Detail>("/api/pga/holds/" + id).then(result => {
      if (!active) return;
      setDetail(result); setForm(result.formInput); formRef.current = result.formInput;
      versionRef.current = result.hold.version;
      setStep(result.hold.status === "Rejected" ? 1 : ["Submitted", "Processing", "Released"].includes(result.hold.status) ? 3 : 0);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!detail || !["Submitted", "Processing"].includes(detail.hold.status)) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      workflowRequest<{ hold: { version: number } }>("/api/pga/holds/" + id + "/status").then(result => {
        if (result.hold.version !== versionRef.current && !dirtyRef.current) void load().then(onChanged).catch(e => setError(e.message));
      }).catch(e => setError(e.message));
    }, 30000);
    return () => clearInterval(timer);
  }, [detail, id, load, onChanged]);
  const save = async () => {
    if (!dirtyRef.current || !detail?.permissions.canUpdate) return;
    const result = await workflowRequest<{ version: number }>("/api/pga/holds/" + id + "/draft", { method: "PATCH", body: JSON.stringify({ version: versionRef.current, formInput: formRef.current }) });
    versionRef.current = result.version; dirtyRef.current = false; setNotice("Draft saved.");
  };
  const perform = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await fn(); } catch (e) {
      setError(e instanceof Error ? e.message : "Please retry.");
      if (e instanceof WorkflowRequestError && e.status === 409) {
        const fresh = await workflowRequest<Detail>("/api/pga/holds/" + id).catch(() => null);
        if (fresh) setConflict(fresh);
      }
    } finally { setBusy(false); }
  };
  const close = () => void perform(async () => { await save(); onClose(); });
  const errors = detail ? validatePreparation(detail.hold.agencyCode, form) : {};
  const editable = !!detail?.permissions.canUpdate && ["Open", "Rejected"].includes(detail.hold.status);
  const latest = detail?.hold.submissions[0];
  const exportNotice = () => {
    if (!detail) return;
    const url = URL.createObjectURL(new Blob([detail.hold.rawNotice], { type: "text/plain" }));
    const a = document.createElement("a"); a.href = url; a.download = "agency-hold-" + id + ".txt"; a.click(); URL.revokeObjectURL(url);
  };
  return <DrawerShell open closeLabel="Save and close drawer" title="Resolve agency hold" onClose={close} busy={busy} footer={
    <div className="flex items-center justify-between gap-3">
      <button disabled={busy} onClick={close} className="text-sm text-ink-muted">{editable ? "Save & close" : "Close"}</button>
      {detail?.fields && <div className="flex items-center gap-3">
        {step > 0 && <button disabled={busy} onClick={() => setStep(s => s - 1)} className="text-sm">Back</button>}
        {step < 3 && <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={busy || (step === 1 && Object.keys(errors).length > 0)} onClick={() => void perform(async () => { await save(); setStep(s => s + 1); })}>Continue</button>}
      </div>}
    </div>
  }>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error} Your unsaved fields remain in this drawer.</p>}
    {conflict && <section aria-label="Review changed hold" className="mb-4 space-y-3 rounded-lg border border-amber-300 p-3 text-sm">
      <h3 className="font-semibold">Review the latest saved values</h3>
      <p>The hold is now {conflict.hold.status}. Your preparation is still here.</p>
      {(conflict.fields ?? []).filter(field => (conflict.formInput[field.id] ?? "") !== (form[field.id] ?? "")).map(field =>
        <div key={field.id} className="break-words"><strong>{field.label}</strong><p>Saved: {conflict.formInput[field.id] || "—"}</p><p>Your draft: {form[field.id] || "—"}</p></div>)}
      <div className="flex flex-wrap gap-3">
        <button className="text-brand" onClick={() => { setDetail(conflict); setForm(conflict.formInput); formRef.current = conflict.formInput; versionRef.current = conflict.hold.version; dirtyRef.current = false; setStep(["Open", "Rejected"].includes(conflict.hold.status) ? 1 : 3); setConflict(null); setError(""); }}>Use latest saved values</button>
        {conflict.permissions.canUpdate && ["Open", "Rejected"].includes(conflict.hold.status) && <button className="text-brand" onClick={() => { setDetail(conflict); versionRef.current = conflict.hold.version; dirtyRef.current = true; setConflict(null); setError(""); setNotice("Your draft is ready to save against the reviewed version."); }}>Keep my draft after review</button>}
      </div>
    </section>}
    {notice && <p role="status" className="mb-3 text-sm text-green-800">{notice}</p>}
    {!detail ? <p role="status">Loading hold…</p> : <>
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        {detail.hold.shipment && <p className="mb-2 text-xs text-ink-muted">Shipment {detail.hold.shipment.shipmentNumber}</p>}
        <div className="flex items-center justify-between gap-3"><strong>{detail.hold.agencyCode} · {detail.hold.holdCode}</strong><span className="text-sm">{detail.hold.status}</span></div>
        <p className="mt-2 text-sm">{detail.explanation}</p><p className="mt-2 text-xs text-ink-muted">Issued {new Date(detail.hold.issuedAt).toLocaleString()}</p>
      </div>
      {!detail.fields ? <div className="space-y-4"><p>Agency not yet supported. Keep the original notice and use your existing agency filing channel.</p><button className="text-brand" onClick={exportNotice}>Export raw hold notice</button></div> : <>
        <ol className="mb-6 grid grid-cols-4 gap-2 text-xs">{["Hold summary", "Prepare", "Review", "Status"].map((name, i) => <li key={name} aria-current={step === i ? "step" : undefined} className={"border-t-2 pt-2 " + (step === i ? "border-brand font-semibold text-brand" : "border-border text-ink-muted")}>{i + 1}. {name}</li>)}</ol>
        {step === 0 && <div className="space-y-4"><p className="text-sm">{detail.transport.reason}</p><details><summary className="cursor-pointer text-sm font-medium">Original agency notice</summary><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs">{detail.hold.rawNotice}</pre></details><button onClick={exportNotice} className="text-sm text-brand">Export notice</button></div>}
        {step === 1 && <div className="space-y-4">
          <p className="text-sm text-ink-muted">Preparation checklist. Approved agency filing rules are still required in your ACE channel.</p>
          {detail.staleDraft && <p className="text-sm text-amber-800">The draft is older than 24 hours. Current entry data has been restored.</p>}
          {latest?.status === "Rejected" && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm">{latest.rejectionCode}: {latest.rejectionReason}</p>}
          <div className="grid gap-4 sm:grid-cols-2">{detail.fields.map(field => {
            const flagged = latest?.rejectedFields?.includes(field.id);
            return <label key={field.id} className={"block text-sm " + (flagged ? "rounded-lg bg-amber-50 p-2" : "")}>
              {field.label}{field.required ? " *" : ""}{detail.prefill[field.id] && form[field.id] === detail.prefill[field.id] && <span className="ml-2 text-xs text-blue-700">from entry</span>}
              <input className={control} type={field.type ?? "text"} value={form[field.id] ?? ""} disabled={!editable || busy} required={field.required} maxLength={2000} aria-invalid={!!(touched[field.id] && errors[field.id])} aria-describedby={errors[field.id] ? field.id + "-error" : undefined}
                onBlur={() => setTouched(v => ({ ...v, [field.id]: true }))}
                onChange={e => { const next = { ...form, [field.id]: e.target.value }; setForm(next); formRef.current = next; dirtyRef.current = true; setNotice(""); requestKey.current = null; }}/>
              {touched[field.id] && errors[field.id] && <span id={field.id + "-error"} className="text-xs text-red-700">{errors[field.id]}</span>}
              {flagged && <span className="text-xs text-amber-800">Flagged by agency response</span>}
            </label>;
          })}</div>
          <p className="text-xs text-ink-muted">{detail.fields.filter(f => f.required && form[f.id]?.trim()).length} / {detail.fields.filter(f => f.required).length} preparation fields completed</p>
          {editable && <button className="text-sm text-brand" disabled={busy} onClick={() => void perform(save)}>Save draft</button>}
        </div>}
        {step === 2 && <div className="space-y-4">
          <p className="text-sm">{detail.transport.reason}</p>
          <dl className="divide-y divide-border">{detail.fields.map(field => <div key={field.id} className="flex justify-between gap-4 py-2 text-sm"><dt className="text-ink-muted">{field.label}</dt><dd className="max-w-[65%] break-words text-right">{form[field.id] || "—"}</dd></div>)}</dl>
          <details><summary className="cursor-pointer text-sm font-medium">Review transmission from your ACE channel</summary><p className="my-2 text-xs text-ink-muted">Paste the exact message you filed. Qubere stores this as evidence; it does not validate or transmit it.</p><textarea aria-label="Filed message text" className={control + " min-h-40 font-mono"} value={messageText} onChange={e => { setMessageText(e.target.value); requestKey.current = null; }}/></details>
        </div>}
        {step === 3 && <div className="space-y-5">
          <p className="text-sm">{detail.transport.reason}</p>
          {["Open", "Rejected"].includes(detail.hold.status) && detail.permissions.canApprove && <div className="space-y-3 rounded-xl border border-border p-4">
            <h3 className="font-semibold">Record a completed manual filing</h3>
            <label className="block text-sm">External filing reference<input className={control} value={externalReference} onChange={e => { setExternalReference(e.target.value); requestKey.current = null; }}/></label>
            <label className="block text-sm">Exact message filed<textarea className={control + " min-h-32 font-mono"} value={messageText} onChange={e => { setMessageText(e.target.value); requestKey.current = null; }}/></label>
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I filed this response through my existing ACE channel.</label>
            <button disabled={busy || !confirmed || !externalReference.trim() || !messageText.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" onClick={() => void perform(async () => {
              await save(); requestKey.current ??= crypto.randomUUID();
              await workflowRequest("/api/pga/holds/" + id + "/submit", { method: "POST", headers: { "Idempotency-Key": requestKey.current }, body: JSON.stringify({ version: versionRef.current, formInput: formRef.current, filedManually: true, externalReference, messageSetText: messageText }) });
              await load(); onChanged(); setNotice("Manual filing recorded. Agency acceptance is not yet confirmed.");
            })}>Record manual filing</button>
          </div>}
          {["Submitted", "Processing"].includes(detail.hold.status) && <p className="rounded-lg bg-blue-50 p-3 text-sm">Awaiting agency response. This status reflects recorded evidence; live ACE polling is unavailable.</p>}
          <button className="text-sm text-brand" disabled={busy} onClick={() => void perform(async () => { await load(); onChanged(); })}>Refresh recorded status</button>
          {latest && ["Submitted", "Processing"].includes(detail.hold.status) && detail.permissions.canApprove && <details className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-medium">Record agency response</summary>
            <div className="mt-3 space-y-3">
              <label className="block text-sm">Agency outcome<select className={control} value={response.status} onChange={e => setResponse(v => ({...v, status:e.target.value}))}><option>Processing</option><option>Rejected</option><option>Released</option></select></label>
              {(["responseCode","reason","rawResponse","responseAt"] as const).map(key => <label key={key} className="block text-sm">{{responseCode:"Response code",reason:"Agency explanation",rawResponse:"Original response evidence",rejectedFields:"Flagged field IDs (comma-separated)",responseAt:"Response received at"}[key]}<input type={key === "responseAt" ? "datetime-local" : "text"} className={control} value={response[key]} onChange={e => setResponse(v => ({...v, [key]:e.target.value}))}/></label>)}
              {response.status === "Rejected" && <fieldset><legend className="text-sm">Fields requiring correction</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{detail.fields.map(field => <label key={field.id} className="flex gap-2 text-sm"><input type="checkbox" checked={response.rejectedFields.split(",").includes(field.id)} onChange={e => setResponse(v => ({ ...v, rejectedFields: (e.target.checked ? [...v.rejectedFields.split(",").filter(Boolean), field.id] : v.rejectedFields.split(",").filter(id => id !== field.id)).join(",") }))}/>{field.label}</label>)}</div></fieldset>}
              <button className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-40" disabled={busy || !response.responseCode || !response.reason || !response.rawResponse || !response.responseAt} onClick={() => void perform(async () => {
                await workflowRequest("/api/pga/holds/" + id + "/status", { method:"PATCH", body: JSON.stringify({...response, version:versionRef.current, submissionId:latest.id, responseAt:new Date(response.responseAt).toISOString(), rejectedFields:response.rejectedFields.split(",").map(s=>s.trim()).filter(Boolean)}) });
                const updated = await load(); onChanged(); if(updated.hold.status === "Rejected") setStep(1);
              })}>Save agency response</button>
            </div>
          </details>}
          <h3 className="font-semibold">Submission history</h3>
          {!detail.hold.submissions.length && <p className="text-sm text-ink-muted">No filing has been recorded.</p>}
          {[...detail.hold.submissions, ...olderSubmissions].map(s => <details key={s.id} className="rounded-lg border border-border p-3 text-sm"><summary className="cursor-pointer">Manual · {s.externalReference} · {s.status} · {new Date(s.submittedAt).toLocaleString()}</summary><pre className="mt-3 overflow-auto whitespace-pre text-xs">{s.messageSetText}</pre>{s.rejectionReason && <p className="mt-2 text-amber-800">{s.rejectionCode}: {s.rejectionReason}</p>}</details>)}
          {detail.submissionTotal > detail.hold.submissions.length + olderSubmissions.length && <button disabled={busy} className="text-sm text-brand" onClick={() => void perform(async () => {
            const result = await workflowRequest<{ submissions: Submission[] }>("/api/pga/holds/" + id + "/submissions?page=" + historyPage);
            setOlderSubmissions(previous => [...previous, ...result.submissions.filter(row => !previous.some(saved => saved.id === row.id) && !detail.hold.submissions.some(saved => saved.id === row.id))]);
            setHistoryPage(page => page + 1);
          })}>Show older submissions</button>}
        </div>}
      </>}
    </>}
  </DrawerShell>;
}
