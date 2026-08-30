# Product & Party Master Data — sales demo guide

**One-liner:** Qubere holds one product record and one party record per tenant —
with per-jurisdiction customs classifications hanging off the product (there is no
single "the HS code"), country of manufacture and country of origin kept as
*different facts*, party identity / roles / registrations tracked as separate
axes rather than one "verified" flag, and a change-detection layer that flags
when a supplier, a spec, or a sourcing fact moves in a way that should trigger
re-review.

**Who to sell it to:** **enterprise trade compliance and master-data owners.**
This is the foundational-data conversation — the thing that makes classification,
origin, screening, and duty math trustworthy at scale. Also relevant to a
**broker** scaling past the point where classifications live in people's heads.

---

## The problem, in the customer's words

- "We have the same product classified three different ways in three systems."
- "Our 'HS code' field assumes one answer. We import the same part into the US,
  the EU, and Mexico — those are different classifications with different
  review status."
- "Origin gets set to whatever the manufacturer's country is. That's not how
  origin works, and it's a Reasonable Care problem."
- "A supplier changed. Nobody re-checked the parts we source from them."
- "Is this party a 'verified supplier'? Depends who you ask and when they last
  looked."
- "Onboarding a new product catalog is a CSV nobody trusts."

---

## Feature → what the customer gets → how to show it

### Product Master

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **One product record, many classifications** | The product holds what's true about the goods everywhere; jurisdiction-specific customs positions are separate records — a US classification, an EU classification, each with its own status, reviewer, and effective window. Only `APPROVED` counts. | `/app/products/[id]` → the classifications section. Show US = APPROVED, EU = IN_REVIEW on the same product. |
| **Origin is a fact, not an inference** | Country of manufacture and country of origin are stored as different facts. Origin is **never** inferred from a manufacturer, supplier, seller, export, or shipping country. If there's no approved origin determination, the system says so. | On a product, show the manufacture country populated but origin marked "no approved determination." The assistant refuses to substitute — see [ai-and-document-intelligence.md](ai-and-document-intelligence.md). |
| **Classification cases with evidence** | A classification is a reviewable case with the rationale, the GRI analysis, the rulings referenced, and the reviewer's identity — not just a code in a field. | `/app/products/[id]/classification/[caseId]` → walk the case: the reasoning, the rulings, who approved it. |
| **Change detection** | Signals that a product's spec, sourcing, or supplier moved in a way that should re-open review — surfaced, not silent. | On a product, show the change history and a flagged change awaiting review. |
| **Sourcing evidence** | The evidence behind a sourcing/origin claim is attached and inspectable (`ProductEvidence`). | Product detail → evidence block. |
| **CSV import with matching** | Bring a catalog in via CSV; Qubere matches against existing records rather than blindly duplicating, and flags ambiguous matches for a human. | `/app/products/import` → the import wizard → the match/review step. |
| **Assistant access** | `get_product`, `search_products`, `get_product_history`, `get_product_evidence`, `get_product_origin_position` — all read-through the same services, RBAC-gated. | `/chat` → *"show me the classification history for product X."* |

### Party Master

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Identity / roles / registrations as separate axes** | One party record. `PartyRole` records that a party acts as supplier, importer, carrier, broker (a party isn't one fixed "type"). `PartyRegistration` tracks per-country registration claims through their own `CLAIMED → UNDER_REVIEW → VERIFIED` lifecycle, independent of the party's own `UNREVIEWED → IN_REVIEW → APPROVED` review status. | `/app/parties/[id]` → show a party with two roles and a country registration mid-review while the party itself is APPROVED. |
| **A name match is never legal-identity proof** | Matching produces candidates; a human confirms identity. The model reflects that — there's no single boolean that collapses "same name" into "same legal entity." | Show the party match flow producing candidates with scores, not an auto-merge. |
| **Screening summary satellite** | Each party carries a `PartyScreeningSummary` — current status, last result, staleness driven by identity-fact changes and reference-data republishes (no fixed TTL). | Party detail → the screening summary; cross-link to [compliance-and-screening.md](compliance-and-screening.md). |
| **Change history & evidence** | Every change to a party's identity facts is tracked; evidence (`PartyEvidence`) is attached. Changes can drive re-screening (RDPS). | Party detail → change history → a change that triggered a re-screen. |
| **CSV import & bulk** | Same match-don't-duplicate import as products. | `/app/parties/import`. |
| **Related records** | Importers of Record, POAs, bonds, and clients are their own managed records linked into the master. | `/app/importers-of-record`, `/app/poa`, `/app/bonds`, `/app/clients`. |

---

## Talking points

- **"There is no 'the HS code.'"** The single most important design point for an
  enterprise with a multi-region import program. One product, N jurisdictions,
  each with its own approved-or-not classification and effective window.
- **"Origin is never inferred."** Say it plainly. Qubere will not set origin from
  a manufacturer country to make a field look full — that's a deliberate
  Reasonable Care stance, and it's enforced all the way to the AI assistant.
- **"Roles and registrations, not a verified flag."** A party can be a
  VERIFIED-registered supplier in one country and an unreviewed identity
  overall — those aren't the same question and Qubere doesn't pretend they are.
- **"Change detection closes the loop with screening."** A supplier moves → the
  parties sourced from them get re-screened → you find out. That's the
  continuous-assurance story the master data makes possible.

## Objection handling

- **"We already have an ERP item master / an MDM tool."** Qubere isn't replacing
  the commercial item master — it's the *customs* master: the per-jurisdiction
  classification, the origin determination, the sourcing evidence, the screening
  summary. It can import from the ERP and be the system of record for the trade
  attributes the ERP doesn't model well.
- **"Auto-classification?"** AI assists classification (with GRI analysis and
  ruling references) and can be allowed to auto-approve above a confidence
  threshold *you* set (see [work-management.md](work-management.md)). It's
  assisted, auditable, and reversible — never a black box that silently sets the
  field.
- **"PEP / beneficial ownership / corporate registry on parties?"** Not yet —
  same known gap as the screening module. Identity, roles, registrations, and
  screening-summary are what's real.
- **"How good is the CSV matching?"** It matches and flags ambiguity for review
  rather than auto-merging. It won't silently create 500 duplicates, and it
  won't silently merge two real distinct entities.

## Demo setup

```bash
npx tsx scripts/seed-qubere-trade-network.ts   # demo products, parties, shipments
```

Use `owner.acme@qubere.ai` (enterprise). Have one product with divergent
per-jurisdiction classification status, one product with no approved origin, and
one party with multiple roles + a mid-review registration. Have a small CSV ready
for the live import.

**Deeper reference:** `docs/product-master.md`, `docs/party-master.md`,
`docs/pre-approved-party-list.md`.
