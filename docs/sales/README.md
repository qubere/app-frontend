# Qubere Sales Enablement

Everything a Qubere seller needs to run a credible enterprise or brokerage
conversation: what each part of the product does, the pain it removes, the exact
clicks to show it, and how to answer the hard questions.

**These docs describe what is actually built and running today.** Where a
capability is partial, in certification, or dependent on a customer integration,
it is called out explicitly — do not oversell past these notes. Qubere's entire
positioning is *"we prove every line item"*; a demo that claims more than the
product does breaks that promise in the room.

---

## The one-sentence pitch

> Qubere turns commercial invoices, packing lists, and product data into
> evidence-backed, review-ready customs decisions — and runs the brokerage's day
> around them, so every shipment walks itself down the compliance pipeline and
> stops only where a licensed human is genuinely required.

## Who we sell to

| Buyer | What they feel | Lead with |
|---|---|---|
| **Enterprise importer** (trade compliance / global trade management) | Reasonable Care exposure, tariff volatility, supplier risk, audit readiness, no single source of truth for classifications and origin | Compliance & Screening, Product & Party Master, Duty & Landed-Cost, AI & Document Intelligence, Security/Trust |
| **Mid-size customs broker** | Staff drowning in ACE portal work, revenue leaking on manual files, clients calling for status, thin margins, key-person risk | Work Management, Billing & Revenue, Partner Portal, Customs Filing, AI & Document Intelligence |
| **Freight forwarder / 3PL** | Documents scattered, exceptions found too late, detention/demurrage surprises, no clean handoff to customs | Freight Execution (TMS), Multi-leg Shipments, Document Management |

## The category docs

| Doc | Sells | Primary buyer |
|---|---|---|
| [customs-filing.md](customs-filing.md) | Document-to-filing: 7501 validation, real HTS duty engine, canonical multi-country messaging, CBP response lifecycle | Broker, enterprise |
| [compliance-and-screening.md](compliance-and-screening.md) | Restricted/denied-party, country embargo, UFLPA, continuous monitoring (RDPS), community batch screening, license determination | Enterprise, broker |
| [ai-and-document-intelligence.md](ai-and-document-intelligence.md) | Docling parsing + Gemini extraction with page/bbox provenance, Ask Qubere assistant, the evidence chain | Both |
| [work-management.md](work-management.md) | Autonomous stage pipeline, routed queues, SLA clocks, escalation, human approval gates | Broker |
| [billing-and-revenue.md](billing-and-revenue.md) | Usage ledger, versioned rate cards, margin visibility, revenue-leakage detection, rate simulation | Broker |
| [partner-portal.md](partner-portal.md) | Client self-service: document requests, shipment visibility, invoices, branded access | Broker, enterprise |
| [document-management.md](document-management.md) | Immutable vault, SHA-256 provenance, inbound-email intake, audit-room export, 19 U.S.C. § 1509 recordkeeping | Both |
| [product-and-party-master.md](product-and-party-master.md) | One global product/party record, per-jurisdiction classifications, origin as a fact not an inference, change detection | Enterprise |
| [duty-and-landed-cost.md](duty-and-landed-cost.md) | Tariff & sourcing simulator, duty-recovery / drawback / PSC readiness, regulatory-change impact assessment | Enterprise, broker |
| [multi-leg-shipments.md](multi-leg-shipments.md) | One canonical leg model, per-leg document checklists, rule-based route inference, the journey ribbon | Forwarder, broker |
| [security-trust-and-platform.md](security-trust-and-platform.md) | Account tenancy, RBAC, SOC2-ready audit log, Clerk identity, partner API, governed data pipeline | Enterprise IT / procurement |
| [freight-execution-tms.md](freight-execution-tms.md) | Six autonomous freight agents, exception detection, movement readiness, margin audit, clean customs handoff | Forwarder / 3PL |

Deeper reference (not seller-facing, but useful prep):
[Billing.md](Billing.md) and
[BILLING-QE-PM-SALES-ASSESSMENT-AND-DEMO-PLAYBOOK.md](BILLING-QE-PM-SALES-ASSESSMENT-AND-DEMO-PLAYBOOK.md),
plus [WORK-MANAGEMENT-SALES-DEMO.md](WORK-MANAGEMENT-SALES-DEMO.md).

---

## Demo environment

| | |
|---|---|
| **Hosted demo** | https://demo-app.qubere.ai |
| **Local** | `npm run dev` → customs app on `http://localhost:3000`, TMS on `http://localhost:3001` |
| **Password (all seeded users)** | `QuberePass2026!` |

### Demo personas

| Login | Context | Use for |
|---|---|---|
| `admin@qubere.ai` | Platform Admin + Acme Corp OWNER | Platform Admin Console, cross-tenant, data pipeline, full app |
| `multirole@qubere.ai` (Frank) | OWNER across all demo accounts | Billing (provisioned by `setup-multirole-user.ts`), anything cross-account |
| `owner.acme@qubere.ai` (Alice) | Acme Corporation — ENTERPRISE | Enterprise importer story |
| `admin@target.com` / `joe@target.com` | Target — ENTERPRISE, sees all account data | Broker-operations story, multi-leg demo shipment `SHP-TGT-2026-001` |
| `sarah@target.com` | Target — PLANNER, restricted to own data | Row-level security, "planner only sees their work" |
| `viewer.acme@qubere.ai` (David) | Acme — VIEWER | Read-only role demo |

### Seed scripts (run before a live demo as needed)

| Script | Sets up |
|---|---|
| `npx tsx apps/custom/scripts/seed-work-management-demo.ts "<account>"` | Four staged shipments so every Work Management row has something to click |
| `npx tsx apps/custom/scripts/seed-billing-demo.ts` | Acme rate cards, usage ledger, invoices, negative-margin client, exceptions |
| `npx tsx apps/custom/scripts/seed-multileg-demo.ts` | Multi-leg journey on `SHP-TGT-2026-001` (non-destructive) |
| `npx tsx apps/custom/scripts/seed-canonical-messaging.ts` | Filing procedure/authority/message config — required before any filing |
| `npx tsx apps/custom/scripts/seed-target-users.ts` | Target brokerage users + shipments |
| `npx tsx apps/custom/scripts/seed-inbound-demo.ts` | Inbound-email document intake mailboxes |
| `npx tsx prisma/import-hts.ts` | HTS tariff schedule — required before classification / duty math works |

---

## How to use a category doc

Each one has the same shape:

1. **One-liner** — the sentence you open with.
2. **Who to sell it to** — enterprise angle vs. small-broker angle.
3. **The problem, in the customer's words** — say this back to them before showing anything.
4. **Feature → what the customer gets → how to show it** — the demo table. Left column is the capability, middle is the benefit/pain it kills, right is the exact navigation and what to point at.
5. **Talking points** — the lines that land.
6. **Objection handling** — the honest answer to the hard question, including what we *don't* do yet.
7. **Demo setup** — seed scripts and prep.

Run the tables top-to-bottom for a full walkthrough, or cherry-pick 3–4 rows for a 10-minute call.
