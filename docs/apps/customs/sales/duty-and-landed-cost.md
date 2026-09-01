# Duty & Landed-Cost Intelligence — sales demo guide

Covers three connected money stories: **sourcing simulation** (model duty before
you sign a PO), **duty recovery** (get back what you overpaid — drawback, PSC,
Section 301, protests), and **regulatory-change impact** (assess a CBP policy
change against *your* catalog, instantly).

**One-liner:** Qubere lets supply-chain and finance teams model landed cost and
sourcing alternatives without a trade attorney, keeps a live readiness inventory
of every entry that might be owed a refund, and assesses each incoming CBP policy
change against your actual product and HTS portfolio.

**Who to sell it to:**

- **Enterprise** — supply-chain, sourcing, and finance. Tariff volatility is a
  P&L problem and today the analysis is a $2–5k, two-week trade-attorney
  engagement per question.
- **Brokers** — the recovery story is found money for the client and a
  differentiated service. "Your competitors aren't checking your old entries for
  refunds."

---

## The problem, in the customer's words

- "We're deciding China vs. Vietnam for a part and the duty math is a guess until
  the first entry actually clears."
- "Section 301 stacking, MPF caps, FTA eligibility — every landed-cost question
  goes to outside counsel and comes back two weeks later."
- "We've almost certainly overpaid duty somewhere. We have no systematic way to
  find it."
- "Drawback is 'someone should look into that' — it never happens."
- "A tariff change hits the Federal Register and we find out when our broker
  mentions it, if they do."
- "A liquidation looks wrong and the protest window is 180 days — we usually miss
  it."

---

## Feature → what the customer gets → how to show it

### Tariff & Sourcing Simulator

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Landed-cost scenarios** | Build a scenario by origin country, HTS code, and cost components (unit cost, quantity, freight, insurance). Duty stack computed off the real HTS engine. | `/app/simulator` → the pre-filled China scenario (HTS 8541.43.0010, 5,000 units). |
| **Sourcing breakeven** | China vs. Vietnam (or any pair) breakeven auto-calculated with the duty differential — the number that used to be a consulting deliverable. | Scroll to **China vs Vietnam Breakeven Analysis**. Ask: *"What would your team charge you to get this from a trade attorney?"* |
| **Side-by-side comparison** | Multiple scenarios compared in one view; save and revisit. | `/app/simulator` → **Compare Scenarios**. |
| **Section 301 readiness built in** | The simulator surfaces Section 301 exposure for affected HTS codes as part of the landed-cost picture. | Point at the Section 301 line in a scenario for a List-3/4A HTS code. |

### Duty Recovery (Post-Entry)

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Opportunity scan** | One scan checks every filed entry for recovery categories: classification review, Section 301 exclusion, trade-agreement claim, first sale, drawback, AD/CVD scope exclusion. **No heuristic estimates** — `estimatedRecovery` stays null until an opportunity is actually confirmed. | `/app/post-entry` → **Duty Drawback** / Recovery → **Scan for Refund Opportunities**. Walk the ranked list. |
| **Drawback lot matching** | Imported lots (created when a filing is accepted, from lines with non-zero duty paid) matched FIFO within HTS code to exports, with over-allocation prevention (serializable transaction, `SELECT FOR UPDATE`). Manufacturing = 99% of base + Section 301 duty; unused-merchandise = 99% in same condition. CBP claim numbers are `{filer}-{year}-{sequence}`, not random. | Recovery → **Drawback Matching** tab → eligible lots, matched pairs, claim status (`DRAFT → PREPARED → SUBMITTED → ACCEPTED`). Only a broker with `drawback.claim` can submit. |
| **Section 301 readiness inventory** | `{ totalEntries, totalDutyPaid, byList }` — how much duty is potentially recoverable by list, so if an exclusion is granted you can move fast. When an exclusion *is* granted (via the Federal Register cron), affected entries automatically get `RefundOpportunity` rows. | Recovery → **Section 301 Readiness** tab → duty paid per list, entry counts. |
| **PSC eligibility & impact** | Post-Summary Correction eligibility check (entry accepted/liquidated, before liquidation, material duty impact, no active drawback claim), correction typing, and an original-vs-corrected duty-delta calculation. Produces a PSC preparation package. | A filing → **Post-Summary Correction** tab → eligibility results + impact calc. |
| **Protests** | Full CBP 19 protest workflow — grounds (classification, valuation, rate of duty, country of origin, liquidation error, drawback denial, exclusion claim, FRP), filing-window tracking, entries attached, status through to filed. | `/app/post-entry/protests` → open a protest → grounds, window, attached entries. |
| **ACE Reconciliation** | Entry-level reconciliation issues (distinct from document conflicts) — `ENTRY_DISCREPANCY`, `PSC_CANDIDATE` — with financial exposure and deadline-to-correct, and a "Convert to PSC" action. | `/app/reconciliation` → grouped by type, sorted by exposure and deadline. |

### Regulatory-Change Impact

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Live regulatory feed** | CBP and trade-policy updates pulled from the Federal Register API (real REST fetcher + AI extraction), auto-creating refund-opportunity records where relevant. | `/app/regulatory` (or `/app/tariffs`) → the feed: tariff adjustments, import restrictions, AD/CVD-related notices. |
| **Assess Impact against your catalog** | Run a regulatory update against *your* product and HTS portfolio and see the exposure — the analysis that used to take a trade attorney a week. | On a feed item → **Assess Impact** → the right panel computes product/shipment exposure. Assistant tool: `run_impact_analysis`. |
| **Action Required flags** | Items needing a team response are flagged, not buried in a feed. | Point at an **Action Required** item. |

---

## Talking points

- **"The consulting deliverable is now a screen."** The sourcing breakeven and
  the regulatory impact assessment each replace a multi-thousand-dollar,
  multi-week external engagement.
- **"No fake numbers."** The recovery scan removed every heuristic multiplier.
  `estimatedRecovery` is null until confirmed. A blank is honest; a made-up
  refund estimate is a liability.
- **"Readiness, not just claims."** The Section 301 inventory means when an
  exclusion drops, you already know which entries and how much — you're not
  starting the analysis then.
- **"The protest window is 180 days and you're missing it."** Reconciliation +
  protest tracking with deadline visibility is the safety net.

## Objection handling

- **"Where does the recovery money actually come from — do you file with CBP?"**
  Qubere identifies opportunities, matches drawback lots, and produces the
  preparation package (claim/PSC/protest). The actual ACE/CBP submission goes
  through the filing path (live with ABI filer credentials) or the broker's
  system. It's the analysis and the package, done systematically — not an
  automatic wire transfer.
- **"How real is the recovery detection?"** The models and workflows
  (`RefundOpportunity`, `DrawbackLot`/`DrawbackMatch`, PSC, protests) are built,
  with real Decimal arithmetic and over-allocation guards. Two honest data gaps:
  Section 301 *exclusion text* matching needs the exclusion dataset (not fully
  ingested), and precise PSC deadlines need CBP liquidation dates (only available
  with an ACE connection) — those show as "unknown" rather than a computed
  guess.
- **"Does the simulator handle AD/CVD?"** Section 301 and standard duty/MPF: yes.
  Automated AD/CVD rate/scope: not yet (dataset gap). The simulator is strongest
  for origin-shift and Section 301 questions today.
- **"Is the regulatory feed comprehensive?"** It's the Federal Register (CBP
  notices) live. USITC trade-remedy orders, Section 232/301 rate annexes, and PGA
  requirements are on the data roadmap, not live — the platform is explicit about
  which datasets are `LIVE` vs `NOT_YET_IMPLEMENTED` (see
  [security-trust-and-platform.md](security-trust-and-platform.md)).

## Demo setup

`npx tsx prisma/import-hts.ts` (duty math) and the Federal Register cron
populated (hosted demo has it). Use `owner.acme@qubere.ai`. Have the China
scenario pre-built in the simulator, at least one filing in `ACCEPTED` status (so
drawback lots and the recovery scan have something to find), and one open protest.

**Deeper reference:** `docs/plans/features/F09-duty-recovery.md`,
`docs/plans/features/F10-regulatory-tariff-intelligence.md`, README "Platform
Dataset Master Registry".
