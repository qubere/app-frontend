# Compliance & Screening — sales demo guide

**One-liner:** Qubere runs seven deterministic, rule-table-driven screening
engines — restricted/denied party, country embargo, UFLPA forced-labor, end-use,
end-user, anti-boycott, military-end-use — on every shipment and every party in
your master, keeps re-screening what it already cleared when the party or the
watchlist changes, and records every hit as immutable evidence with the reviewer
judgment kept separate, so a past HIT is never quietly rewritten.

**Who to sell it to:**

- **Enterprise trade compliance / global trade management** — the buyer who owns
  OFAC/BIS/UFLPA exposure across thousands of suppliers and needs *continuous*
  assurance, an audit trail, and a defensible "we screened, here's the evidence."
- **Customs brokers** — increasingly the value-add is "we keep you off the denied
  party list." Screening as a billable, provable service (see
  [billing-and-revenue.md](billing-and-revenue.md)), not a checkbox.

---

## The problem, in the customer's words

- "We screen against OFAC at onboarding. We do not re-screen when OFAC updates the
  SDN list — which is basically weekly."
- "A name match in our old tool is treated as a legal-identity match. It isn't,
  and our analysts waste days clearing false positives with no way to record why."
- "When we clear a party, that decision is a status field someone can overwrite.
  There's no immutable record of the hit that was there before."
- "UFLPA is a board-level risk and our answer is a spreadsheet of Xinjiang
  suppliers someone updates quarterly."
- "If we need to screen a 4,000-row acquired supplier list, that's a two-week
  project."
- "License determination is a compliance analyst reading control lists by hand."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Restricted/Denied-Party Screening** | Every Party Master record and every shipment/line-level party screened against SDN, Consolidated non-SDN, DPL, ISN, SSI, FSE, PLC, NS-MBS — exact, raw-word, and a phonetic (Double Metaphone / Metaphone2, configurable per account) shortlist feeding a fuzzy scorer, plus an independent red-flag keyword check. | `/app/compliance` → **Screening** tab → **Party Screening** sub-tab. Open a party with a potential match; show the score, the matched list, and the phonetic vs exact reason. |
| **Immutable results, separate dispositions** | Every screening result is frozen. The reviewer's judgment (Approved / False Positive / Blocked) is a separate record, 1:1 with the result. A later clean run never erases an earlier hit. | On a party's screening history, show two runs — an earlier HIT with a "False Positive — same name, different DUNS, analyst note" disposition, and a later CLEAR. Both are on the record. |
| **Country Embargo Screening** | Deterministic engine (never an LLM) evaluating transaction, party, and line-level country pairs against government country-by-country maps, country groups, and CCL/ECCN data. A run that had to skip a check (party with no country on file) is reported as PARTIAL, not CLEAR. | **Screening** tab → embargo sub-tabs. Show a shipment's embargo result with the checks performed / passed / failed counts distinct from the deduplicated hit count. |
| **Private Embargo overlay** | A tenant layers its own country-pair rules in front of the government matchers. A private rule can only *add* a HIT — it can never manufacture a CLEAR. | `/app/admin/settings` → **Private Embargo Rules**. Add a rule (e.g. "no transactions touching Country X"), then re-screen a shipment and show the new HIT with its private-rule provenance. |
| **UFLPA / forced-labor** | The DHS UFLPA Entity List is ingested and screened as a first-class module, not a side spreadsheet. | Show a party matched to the UFLPA Entity List in the screening workspace, with the entity-list citation. |
| **RDPS — continuous / reverse screening** | Previously-cleared parties are automatically re-screened when *their* data changes or when the *watchlist* data changes. A delta-impact dispatcher reacts to a specific reference-data change within minutes; a full-population dispatcher re-screens the whole account on a schedule. Every outcome records whether the result worsened and a deterministic transition type (NEW_HIT / ESCALATED / RISK_REDUCED / CLEARED / …). | `/app/compliance` → **RDPS panel**. Show open RDPS alerts. Open a reference-data change set → **Impacted Parties** drill-down: exactly which parties were re-screened because of it. Show **Preview Impact**: what a change *would* match today, without recording anything. |
| **Reference-data expiry sweep** | An hourly job catches watchlist entities whose own expiration date elapsed while still sitting active in every feed — a case the ingestion services themselves miss. | Explain the mechanism on the RDPS panel; show a `changeType: EXPIRED` outcome. |
| **Community Screening (batch)** | Submit a batch of parties (manual entry or file upload); Qubere runs the *canonical* RPS and embargo engines against every row — it orchestrates, it never re-implements matching. A denied-party match and a red-flag keyword hit stay independent findings; a valid pre-approval short-circuits and is its own status. | `/app/compliance/community-screening` → upload a CSV of parties → open the run. Show per-row `restrictedPartyFindingCategory` labels (NO_MATCH / CONFIRMED_MATCH / POTENTIAL / RED_FLAG_ONLY / PAL_SUPPRESSED). Export the run as CSV/XLSX. |
| **Pre-Approved Party List (PAL)** | A prior clearance is reused instead of re-screening — but only through a fail-closed gate: identity-hash match, matching party version, fresh-enough reference data, no expiry, no revocation. Any gap falls straight through to a normal screening run. | Show a party clearing via **PRE_APPROVED_REUSE** (distinct from an ordinary CLEAR), and explain the five conditions the gate checks. |
| **License Determination** | A deterministic engine (never an LLM) that evaluates whether an export/import operation needs a government authorization. Because no jurisdiction control-rule datasets are loaded, it **never fabricates** a LICENSE_REQUIRED / NO_LICENSE_REQUIRED outcome — it returns RULE_DATA_UNAVAILABLE / INCOMPLETE / REVIEW_REQUIRED with full evidence of what was and wasn't evaluated. Any sensitive end-use/end-user flag hard-stops to REVIEW_REQUIRED. | `/app/license-management` → **Run determination**. Show the fail-safe outcome and the evidence of exactly what was checked. This *is* the pitch: it will not guess. |
| **License Management lifecycle** | Once a positive determination exists: license/line/party/document CRUD, an event-sourced utilization ledger (single writer, idempotent, optimistic-concurrency), reason-required manual adjustments, allocation reserve/release against remaining capacity, daily expiry/utilization-threshold alerts. | License detail page → utilization / adjustment / allocation history, parties, documents. Show the alert cron's digest. |
| **Compliance Audit Agent** | All seven screening modules run as concurrent checks inside one pipeline on every shipment, producing findings by category and severity, attached to the shipment as evidence. | Open a shipment → **Compliance** tab / agent timeline. Show the concurrent findings. Or `/app/compliance` → **Run Compliance Audit**. |
| **Formal overrides** | A compliance officer can create/revoke a formal override against any screening or determination result, from the audit panel — the same generic mechanism every compliance domain shares, `compliance.override`-gated and fully logged. | On a screening execution detail, show **Create formal override** with its required reason, and the audit entry it leaves. |
| **Notifications & audit** | Compliance events (RPS hit/review/rescreen, license review-required, portfolio expiry digest) queue durable notifications through an outbox/dispatcher pipeline — never sent inline — and every action writes an immutable `AuditLog` entry. | `/app/compliance` → **Audit History** tab. Show the timestamped event stream and the export. |
| **Partner API** | External systems hit the same screening read/rescreen behavior via API key (`/api/v1/screening/restricted-party`, `/api/v1/compliance/embargo-screening`), scoped (`embargo.read` vs `embargo.screen`), idempotent, audit-tagged `source: "API"`. | `/app/admin/integrations` → show the API key panel and the scopes. |

---

## Talking points

- **"Deterministic, not an LLM."** Say it early and often. Every screening
  verdict comes from a rule table and a scorer you can inspect — not a model
  that "sounds confident." The AI in the platform does analysis *inside* stages;
  it never decides a sanctions hit.
- **"Screening isn't a moment, it's a subscription."** RDPS is the
  differentiator against every onboarding-only tool. The watchlist changed this
  week — did your cleared parties get re-checked? Qubere's did, automatically,
  and you can see exactly which ones and why.
- **"A name match is not a legal-identity match."** Immutable results +
  separate dispositions means your analysts' false-positive judgments are
  recorded once and never re-litigated — and a real hit can never be
  status-fielded away.
- **"UFLPA is a module, not a spreadsheet."** First-class entity-list screening
  with citations, in the same workflow as everything else.

## Objection handling

- **"What lists do you actually screen against today?"** Live and ingesting on a
  governed schedule: OFAC SDN + Consolidated non-SDN (~20k entries, streamed via
  a durable job), BIS Consolidated Screening List (10 agency lists via
  `api.trade.gov`), DHS UFLPA Entity List, CBP CROSS rulings, and a Dow Jones
  full-feed pipeline carrying provider lineage and multi-valued alias/address/
  identifier/reference data per profile.
- **"Do you do PEP screening / beneficial ownership / corporate registry?"** Not
  yet — deliberately called out as a known gap, along with autonomous approval
  and fuzzy matching beyond the phonetic shortlist. Sell what's there: the
  denied-party, embargo, and forced-labor coverage is real and continuous.
- **"License determination sounds like it doesn't do anything."** It does the
  opposite of nothing — it does the *honest* thing. It runs classification-format
  validation, tri-state end-use/end-user handling, and license-exception
  evaluation as pure functions, and it refuses to output a fake control-list
  answer when the control-list data to back it hasn't been loaded. For a
  regulated exporter, an engine that says "REVIEW_REQUIRED, here's exactly what I
  could and couldn't check" is more valuable than one that guesses.
- **"AD/CVD scope screening?"** There's an AD/CVD scope-screening route and an
  `get_adcvd_orders` assistant tool, but automated ingestion of the USITC trade
  remedy orders dataset is not live yet — treat AD/CVD as assisted, not
  automated.

## Demo setup

Screening runs against seeded parties and shipments; `admin@qubere.ai` or
`owner.acme@qubere.ai`. For the batch demo, have a CSV of ~10–20 party
name/address rows ready (include one obvious SDN-style name to force a hit). For
RDPS, the demo data includes reference-data change sets — check the RDPS panel
has open alerts before the call.

**Deeper reference:** `docs/restricted-party-screening-implementation-report.md`,
`docs/rdps-continuous-monitoring.md`, `docs/community-screening.md`,
`docs/pre-approved-party-list.md`, `docs/private-embargo-screening.md`,
`docs/LICENSE-DETERMINATION-GAP-MATRIX.md`.
