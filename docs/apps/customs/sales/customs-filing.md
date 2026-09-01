# Customs Filing — sales demo guide

**One-liner:** Qubere takes a shipment's line items, parties, and documents and
builds a validated, duty-calculated CBP entry — checks it against a real Form
7501 checklist, prices it with a live HTS tariff engine, freezes an auditable
declaration snapshot, and drives the full transmit → CBP-response → release →
closure lifecycle, with resubmission and cancellation paths — instead of a broker
re-keying the same data into ACE.

**Who to sell it to:**

- **Customs brokers** — the people who live in the ACE portal today. The pitch is
  hours-per-entry and error rate: the data is already in Qubere from the
  documents, the validation catches the rejection *before* CBP does, and the
  entire CBP conversation lands back in one workspace.
- **Enterprise importers who self-file or co-file** — the pitch is control and
  evidence: a versioned declaration snapshot, a 7501 preview, and an audit
  package for every entry, so Reasonable Care is documented, not asserted.

---

## The problem, in the customer's words

- "Every entry is data entry. It's on the commercial invoice, it's on the packing
  list, it's in our product database — and someone still types it into ACE line
  by line."
- "We find out an entry was wrong when CBP rejects it. Then it's a scramble to
  figure out which field, fix it, and resubmit — usually against a clock."
- "Duty math is a spreadsheet and a prayer. Nobody's confident about MPF caps,
  Section 301 stacking, or which HTS rate was actually in effect that week."
- "If CBP ever audits us, reconstructing 'what did we know and when' for an entry
  from two years ago means digging through email and a shared drive."
- "Our filing platform is one country. Anything outside the US is a different
  system and a different team."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Draft entry built from the shipment** | The entry is assembled from line items, parties, and documents already on the shipment — not re-keyed. It fails closed if a destination country, a procedure mapping, an authority config, or line items are missing, so you never get a half-built filing that looks complete. | Open a ready shipment → **Send to Customs Filing**. Show the draft appearing pre-populated. Then open `/app/filing` and point at the entry list with importer, value, country, status. |
| **Real HTS duty & MPF engine** | Duty, MPF, and fee math computed from the actual published US Harmonized Tariff Schedule (auto-refreshed nightly from USITC, human-approved before it goes live), not a percentage guess. If any line is unrated, the duty fields stay blank rather than understating the number. | On a filing, open the **7501 Preview** tab. Walk one line: HTS code → duty rate → extended value → duty. Note the rate came from a specific published HTS release. |
| **Form 7501 validation checklist** | Every entry is checked against a named rule set before it can move: required 7501 blocks populated, every line has an approved classification, importer CBP number valid (9 digits), port of entry is a real ACE code, bond not expired, no unresolved blocking exceptions or reconciliation issues, HTS release current. Each failure names the exact field. | Click **Validate** on a filing with a gap. Show the blocker list — e.g. *"2 line items have an HTS code but no approved classification decision."* Fix it, re-validate, watch it clear to **Ready for Broker Review**. |
| **Licensed-broker approval gate** | A filing cannot legally reach a transmittable state without an explicit broker approval step — it's a real transition in the state machine, on the record with who approved it. | Show the **Approve** action and the resulting status change. On the shipment's stage history: *"Approved by Sarah Chen, License #12345."* |
| **Frozen declaration snapshot** | At transmit time Qubere freezes a `FilingSnapshot` — the exact shipment, line-item, document, and header data as filed — and builds a versioned canonical declaration. Later edits to the shipment never rewrite what was filed. | Transmit a filing. Open the **Declaration** tab and point out the version number. Explain: "This is what CBP got. If the shipment changes tomorrow, this snapshot doesn't." |
| **CBP response lifecycle in one place** | Accept, reject, release, hold, documents-requested, cancellation — every CBP response maps through a table-driven state machine to the filing status. No logging into ACE to check where an entry stands. | Open the **Response** tab on a transmitted filing. Show the status history: Transmitted → Accepted → Released → Closed, each with a timestamp. |
| **Reject → correct → resubmit** | On a rejection, the filer corrects the underlying data (HTS code, country of origin) through the same audited edit path, then hits **Save & Resubmit** — Qubere rebuilds the declaration from the corrected data and threads the new message back to the original. | On a rejected filing, edit an HTS code on the Declaration tab, **Save & Resubmit**, show the new version and the link back to the prior message. |
| **Cancellation, request-then-confirm** | Withdraw a filed entry with the country-specific extra data that withdrawal requires (e.g. a guarantee reference), tracked as *Cancellation Requested* until CBP confirms. Pre-transmission filings cancel straight out. | Show the **Cancel Filing** child action on an eligible filing and the confirmation form it prompts for. |
| **Country-agnostic by construction** | Entry type, procedure, authority, message routing, response mapping, allowed post-filing edits, and offered actions all resolve from database tables keyed by `(country, procedure)`. Germany was added with zero application-code changes — proof the model isn't US-only. | `/app/filing-config` → show the procedure/authority/message-catalog tables. Explain: adding a country is seed data, not a new codebase. |
| **Audit package per entry** | One click assembles a Reasonable Care package and a Focused Assessment file for a ±7-day window around the filing — the evidence bundle you hand CBP. | On a filing, **Generate Audit Package**. Show what's in it: the declaration, the classification decisions with evidence, the documents, the timeline. |
| **Practice mode** | A `Simulation` filing runs the whole flow — validation, duty math, 7501 preview — but is excluded from every real transition, so it can never reach a CBP status. Train staff on real data safely. | Create a Simulation filing and show it runs validation and duty math but the transmit action is inert. |

---

## Talking points

- **"The rejection you're about to get from CBP — we catch it here first."** The
  validation checklist is the same set of blocks CBP checks. Show a blocker
  getting caught and fixed in the app before transmit.
- **"Every entry has a snapshot."** The single most defensible thing in the
  module: what was filed is frozen and versioned, separate from the live
  shipment. That's the answer to "prove what you declared."
- **"Adding Germany was a spreadsheet, not a sprint."** The country-agnostic
  architecture is the enterprise-scale story — one platform for a multi-country
  program, not one integration per authority.
- **"Duty math you can trace to a published rate."** Not a model, not a
  heuristic — a specific HTS release, human-approved, with the line-by-line
  breakdown visible.

## Objection handling

- **"Are you actually transmitting to CBP / ACE today?"** Be straight: Qubere
  builds and validates the ABI/ACE message, freezes the declaration, and runs the
  full response lifecycle — and in the demo environment a simulated CBP response
  is applied inline so you can see the whole flow. **Live ABI transmission
  activates when a customer's CBP ABI filer credentials are configured** (it's a
  config switch, `RealAceProvider`, not a rebuild); direct CBP ABI certification
  is on the roadmap. What's real today is everything up to and including the
  transmittable message and the entire post-response state machine.
- **"What entry types do you support?"** The full 18 CBP Block-2 codes are in the
  vocabulary. The *workflow* implemented end-to-end is consumption-style entry
  (Type 01/03/11 and similar). Warehouse (21/31) and in-bond (61/62/63) exist as
  selectable types but don't have regime-specific bonded-storage or in-bond
  movement tracking yet.
- **"Does duty math handle AD/CVD and Section 301?"** Section 301 is applied where
  the rate exists in the HTS duty-rate data. Automated AD/CVD scope and rate
  ingestion is not live yet — those are flagged for human handling. Be honest:
  this is a known data-pipeline gap, not a silent wrong number (unrated lines
  show blank, never a guess).
- **"We file outside the US."** The messaging layer is genuinely
  country-agnostic and Germany is seeded as proof. Duty/MPF calculation still
  runs as a US CBP calculation regardless of destination today — the entry
  build, validation, and lifecycle are portable; the duty engine
  internationalization is in progress.

## Demo setup

```bash
npx tsx apps/custom/scripts/seed-canonical-messaging.ts   # filing config — required
npx tsx prisma/import-hts.ts                              # HTS schedule — required for duty math
npx tsx apps/custom/scripts/seed-target-users.ts          # brokerage users + shipments
```

Use `admin@qubere.ai` or `joe@target.com`. Have one shipment fully ready (to show
a clean draft → validate → approve) and one with a classification gap (to show a
validation blocker getting caught).

**Deeper reference:** `docs/customs-filing/01-functional-overview.md` (current
behavior, grounded in source), `docs/customs-filing/customs-filing-canonical-messaging-changelog.md`
(the Germany proof).
