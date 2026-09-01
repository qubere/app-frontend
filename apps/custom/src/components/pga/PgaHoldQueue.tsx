"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { workflowRequest } from "@/lib/brokerWorkflowClient";
import { AGENCIES } from "@/lib/pga/holdContracts";

type Hold = { id: string; shipmentId: string; agencyCode: string; holdCode: string; status: string; reasonText: string; issuedAt: string;
  shipment: { shipmentNumber: string; importerName: string; filingDeadline: string | null } };
export function PgaHoldQueue({ canReview }: { canReview: boolean }) {
  const [data, setData] = useState<{ holds: Hold[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [agency, setAgency] = useState("");
  const [importer, setImporter] = useState("");
  const [sort, setSort] = useState("oldest");
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ page: String(page) });
      if (canReview) { q.set("sort", sort); if (agency) q.set("agency", agency); if (importer) q.set("importer", importer); }
      workflowRequest<{ holds: Hold[]; total: number }>("/api/pga/holds?" + q)
        .then(result => { if (active) { setData(result); setError(""); } })
        .catch(e => { if (active) setError(e.message); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [agency, importer, sort, page, reload, canReview]);
  if (!data && !error) return <p className="text-sm text-ink-muted" role="status">Loading agency holds…</p>;
  if (data?.total === 0 && !agency && !importer && !error) return null;
  const groups = new Map<string, Hold[]>();
  for (const hold of data?.holds ?? []) groups.set(hold.shipmentId, [...(groups.get(hold.shipmentId) ?? []), hold]);
  return <section aria-label="PGA holds" className="rounded-2xl border border-amber-200 bg-white p-5 shadow-2xs">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="font-semibold text-ink">Agency holds <span className="text-amber-700">{data?.total ?? ""}</span></h2><p className="text-xs text-ink-muted">Resolve the hold without losing shipment context.</p></div>
      <button className="text-sm text-brand" onClick={() => setReload(x => x + 1)}>Refresh holds</button>
    </div>
    {canReview && <div className="my-4 flex flex-wrap gap-3">
      <label className="text-xs">Agency<select aria-label="Hold agency" value={agency} onChange={e => { setAgency(e.target.value); setPage(0); }} className="ml-2 rounded-lg border border-border p-2"><option value="">All agencies</option>{AGENCIES.map(a => <option key={a}>{a}</option>)}</select></label>
      <label className="text-xs">Importer<input value={importer} onChange={e => { setImporter(e.target.value); setPage(0); }} className="ml-2 rounded-lg border border-border p-2" placeholder="Filter importer"/></label>
      <label className="text-xs">Age<select value={sort} onChange={e => { setSort(e.target.value); setPage(0); }} className="ml-2 rounded-lg border border-border p-2"><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select></label>
    </div>}
    {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
    {[...groups.entries()].map(([id, holds]) => <div key={id} className="mt-3 flex flex-wrap items-start justify-between gap-4 border-t border-border pt-3">
      <div><Link href={"/app/shipments/" + id} className="font-medium text-brand">{holds[0].shipment.shipmentNumber}</Link><p className="text-sm text-ink-muted">{holds[0].shipment.importerName}</p>
        {holds[0].shipment.filingDeadline && <p className="mt-1 text-xs text-amber-800">Filing deadline: {new Date(holds[0].shipment.filingDeadline).toLocaleString()}</p>}
      </div>
      <ul className="space-y-2">{holds.map(h => <li key={h.id} className="flex flex-wrap items-center gap-3">
        <span className={"rounded-full px-2 py-1 text-xs font-semibold " + (h.status === "Rejected" ? "bg-red-50 text-red-800" : h.agencyCode === "FDA" ? "bg-blue-50 text-blue-800" : h.agencyCode === "USDA" ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800")}>{h.agencyCode} · {h.status}</span>
        <span className="text-xs text-ink-muted" title={new Date(h.issuedAt).toLocaleString()}>{Math.max(0, Math.floor((Date.now() - Date.parse(h.issuedAt)) / 86400000))} days</span>
        <Link className="text-sm font-medium text-brand" href={"/app/shipments/" + id + "?pgaHold=" + h.id}>Resolve hold →</Link>
      </li>)}</ul>
    </div>)}
    {data && data.total > 25 && <div className="mt-4 flex items-center justify-end gap-4 text-sm">
      <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="disabled:opacity-40">Previous</button>
      <span>Page {page + 1} of {Math.ceil(data.total / 25)}</span>
      <button disabled={(page + 1) * 25 >= data.total} onClick={() => setPage(p => p + 1)} className="disabled:opacity-40">Next</button>
    </div>}
  </section>;
}
