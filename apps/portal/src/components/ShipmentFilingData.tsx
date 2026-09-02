import Link from 'next/link';

export interface PortalFilingData {
  importerName: string;
  countryOfOrigin: string | null;
  countryOfExport: string | null;
  destinationCountry: string | null;
  portOfEntry: string | null;
  entryType: string | null;
  incoterm: string | null;
  invoiceCurrency: string | null;
}
export interface PortalEntry {
  id: string; entryNumber: string; status: string; publishedAt: string;
  entryType?: string | null; country?: string | null; procedureCode?: string | null; filingType?: string | null;
  dutyTotal?: number | null; taxTotal?: number | null;
  proof?: { available: boolean; scoreOverall: number; scoreBand: string } | null;
  lines?: { lineNumber: number; description: string; htsCode: string | null; countryOfOrigin: string | null; quantity: number; enteredValueUsd: number; lineDutyTotalUsd: number; dutyComplete: boolean }[];
}
const money = (n: number | null | undefined) => n == null ? 'Not available' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export function ShipmentFilingData({ data, entries }: { data: PortalFilingData; entries: PortalEntry[] }) {
  return <div className="space-y-5">
    <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-semibold">Logistics & entry identity</h2><dl className="grid gap-5 mt-5 sm:grid-cols-2 lg:grid-cols-3">{[
      ['Importer', data.importerName], ['Entry type', data.entryType], ['Port of entry', data.portOfEntry], ['Origin country', data.countryOfOrigin], ['Export country', data.countryOfExport], ['Destination country', data.destinationCountry], ['Incoterm', data.incoterm], ['Invoice currency', data.invoiceCurrency],
    ].map(([title, value]) => <div key={title}><dt className="text-xs text-slate-500">{title}</dt><dd className="text-sm font-medium mt-1">{value || 'Not on file'}</dd></div>)}</dl></section>
    <section className="space-y-4"><h2 className="font-semibold">Published filing data</h2><p className="text-xs text-slate-500">Entry and line details reflect the information your broker has published.</p>
      {!entries.length && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Your broker has not published filing data for this shipment yet.</p>}
      {entries.map(entry => <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap justify-between items-center gap-3"><h3 className="font-semibold">{entry.entryNumber}</h3><span className="text-xs rounded-full bg-blue-50 px-3 py-1 text-blue-800">{entry.status}</span></div><dl className="grid gap-4 mt-5 sm:grid-cols-2 lg:grid-cols-4">{[
        ['Country', entry.country || 'Not on file'], ['Entry type / procedure', [entry.entryType, entry.procedureCode].filter(Boolean).join(' · ') || 'Not on file'], ['Duty', money(entry.dutyTotal)], ['Taxes', money(entry.taxTotal)],
      ].map(([title, value]) => <div key={title}><dt className="text-xs text-slate-500">{title}</dt><dd className="text-sm mt-1">{value}</dd></div>)}</dl>
        {!!entry.lines?.length && <div className="overflow-x-auto mt-5"><table className="w-full text-sm text-left"><caption className="text-left font-medium pb-3">Published line items</caption><thead><tr>{['Line', 'Description', 'HTS', 'Origin', 'Quantity', 'Entered value', 'Duty & fees'].map(h => <th key={h} className="p-3 bg-slate-50 text-xs font-medium">{h}</th>)}</tr></thead><tbody>{entry.lines.map(l => <tr key={l.lineNumber} className="border-t border-slate-100"><td className="p-3">{l.lineNumber}</td><td className="p-3">{l.description}</td><td className="p-3 font-mono">{l.htsCode || 'Not published'}</td><td className="p-3">{l.countryOfOrigin || 'Not published'}</td><td className="p-3">{l.quantity}</td><td className="p-3">{money(l.enteredValueUsd)}</td><td className="p-3">{l.dutyComplete ? money(l.lineDutyTotalUsd) : <span className="text-amber-800">{money(l.lineDutyTotalUsd)} known · partial</span>}</td></tr>)}</tbody></table></div>}
        {entry.proof?.available && <Link href={`/entries/${entry.id}`} className="inline-block text-sm font-medium text-[#0071E3] mt-5 hover:underline">Inspect Entry Proof →</Link>}
      </article>)}
    </section>
  </div>;
}
