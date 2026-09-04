# Freight Execution (TMS) — sales demo guide

**One-liner:** Qubere TMS (`apps/tms`, `localhost:3001`) is an autonomous freight
execution app: every logistics document that lands fires a six-agent pipeline
that classifies it, promotes route and reference data onto the shipment, checks
document and movement readiness, audits carrier quotes and margin, and assigns a
real-time health status — so a dispatcher works exceptions, not spreadsheets, and
the customs handoff is clean.

**Who to sell it to:** **freight forwarders, 3PLs, NVOCCs, and dispatch teams.**
For an existing Qubere customs customer, it's "the same intelligence for the
movement side." For a forwarder buying TMS-first, it's document-native execution.

---

## The problem, in the customer's words

- "Every shipment is 8–15 documents from carriers, customers, and warehouses.
  Someone reads each one and re-keys the important bits."
- "We find out about a detention/demurrage problem when the invoice arrives."
- "The MBL says one discharge port, the booking says another. Nobody catches it
  until it's a problem."
- "Carrier tendered, no response, SLA blew — and we didn't re-tender because
  nobody was watching that clock."
- "Buy/sell margin on a load is a month-end surprise."
- "The customs broker gets a shoebox of PDFs and starts the classification from
  scratch."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **1 · Document Intake Agent** | Every logistics PDF (BoL, AWB, commercial invoice, packing list, POD, carrier invoice, booking request/confirmation) is classified and **100% of visible freight facts** are extracted with evidence provenance — including raw key-value pairs, dates (cut-off, ETD, ETA), move types (FCL/FCL), vessel/voyage, line items, and unmapped fields. Nothing is discarded. | TMS → upload a BoL to a shipment → the extraction with the raw metadata captured, not just the mapped fields. |
| **2 · Shipment Enrichment Agent** | Extracted facts are promoted onto the operational `Shipment` and `TransportationOrder` rows — route (export/destination country, mode, port of entry), tracking refs (MBL, HBL, booking, container), equipment, cargo lines. Downstream agents build on accumulated state; no step filters prior facts. | Show the shipment record populating from the document — MBL/HBL/container appearing on the order. |
| **3 · Document Readiness Agent** | Mode- and customs-dependent completeness (e.g. BoL + packing list + commercial invoice), evaluated against RAG account memory, raising/resolving `ExceptionItem` records automatically. | TMS → **Exceptions** → a `DOCUMENT EXCEPTION` the agent raised, and one it auto-resolved when the missing doc arrived. |
| **4 · Movement Readiness Agent** | Positioning, stops, equipment requirements, and carrier tracking references verified for execution readiness. | A shipment's movement readiness status and the specific gap flagged. |
| **5 · Cost & Carrier Readiness Agent** | Linehaul and drayage quotes, tenders, and buy/sell margins audited against approved target margins. | TMS → a shipment with a margin flag; the `Policy Engine` note explaining why. |
| **6 · Operational Risk Agent** | Tracking freshness, customer-promise buffers, **last free day (LFD) detention risk**, and open exceptions rolled into a real-time health status: Healthy / At Risk / Critical. | TMS → **Command Center** / Shipments workbench → the health column. Open an **At Risk** shipment → "delivery promise date at risk" / "demurrage risk". |
| **Exception workbench with SLA + escalation** | Exceptions grouped by type (dispatch, tender, document, transportation, decision), each with an SLA window, breach state, and an escalation target (e.g. Operations Lead). Actions like **Re-Tender Carrier**, **Modify Dispatch** inline. | TMS → **Exceptions** → a `CARRIER TENDER DISPATCH TIMEOUT` with "ACTION REQUIRED IN 1H 42M" and the re-tender action. |
| **Orders, quotes, tenders, carriers** | Full operational objects — transportation orders, freight quotes, carrier tenders, carrier master with FMCSA/DOT references. | TMS → `/orders`, `/quotes`, `/tenders`, `/carriers`. |
| **Freight invoices** | Carrier invoice capture and audit against the quote/tender. | TMS → `/invoices` → a carrier invoice matched (or not) to its quote. |
| **Document vault** | The same immutable, hashed, provenance-tracked storage as the customs app. | TMS → `/documents`. |
| **TMS assistant** | A `/chat` assistant scoped to freight ops — same architecture as Ask Qubere. | TMS → `/chat`. |
| **Clean customs handoff** | Because enrichment already promoted route, parties, container, and cargo lines with provenance, the customs side starts from structured, evidence-backed data — not a shoebox of PDFs. Multi-leg is the shared model ([multi-leg-shipments.md](multi-leg-shipments.md)). | Show a shipment that exists in both apps with the shared data. |

---

## Talking points

- **"Zero data loss."** Every agent operates under an Additive Intelligence
  Mandate — raw metadata, contacts, dates, move types, unmapped fields all
  captured. No step throws away what an earlier step found. That's the opposite
  of "extract the 6 fields we mapped and drop the rest."
- **"The dispatcher works exceptions."** Health status and the SLA-clocked
  exception workbench mean attention goes where the risk is — LFD, tender
  timeout, promise-date-at-risk — not to reading every document.
- **"Detention risk before the invoice."** The Operational Risk Agent watches
  last-free-day and promise buffers continuously.
- **"One platform, movement to entry."** For a forwarder who also needs customs,
  the enrichment work is done once and the broker inherits it.

## Objection handling

- **"Do you connect to carrier EDI / ocean visibility / telematics?"** The
  pipeline consumes tracking events and documents that arrive; the exception
  workbench references EDI 214 and telematics as event sources. Packaged direct
  integrations to specific carriers/visibility providers are a scoped
  implementation item, not a checkbox — confirm the specific carrier before
  committing.
- **"Is this a full TMS — rating, routing guide, appointment scheduling?"**
  There's rating, tendering, movement/stop/appointment modeling, and a policy
  engine for margin. It is not a mature load-board / brokerage-TMS replacement
  for a large 3PL with complex routing guides — position it as autonomous
  execution and exception management, strongest for forwarder/import flows.
- **"How does it relate to the customs app?"** Same monorepo, same identity,
  same design system, shared document and (Phase 1) leg models. Sold and
  deployed together or standalone.

## Demo setup

```bash
npm run dev --workspace=@qubere/tms      # TMS on http://localhost:3001
```

Login `admin@qubere.ai` or `sarah@target.com` (planner / document intake).
Have one shipment with documents processed (to show enrichment), one **At Risk**
with an LFD flag, and one open tender-timeout exception.

**Deeper reference:** `apps/tms/README.md`, README §15,
`docs/plans/review/TMS-*` review docs.
