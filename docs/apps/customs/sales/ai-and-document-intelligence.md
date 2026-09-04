# AI & Document Intelligence — sales demo guide

**One-liner:** Qubere turns an uploaded PDF into filing-ready facts where every
single field traces back to a page, a bounding box, and the original document
(SHA-256-verified on every read) — and puts a natural-language assistant in front
of the whole platform that answers only with real, linked records and runs every
action through the exact same permission and audit checks as the UI.

**Who to sell it to:**

- **Everyone**, but frame it differently: to the **enterprise** it's evidentiary
  accuracy and Reasonable Care; to the **broker** it's "the data-entry job is
  gone"; to a **technical buyer** it's "the AI never sees SQL, never sees another
  tenant's rows, and can't approve its own work."

---

## The problem, in the customer's words

- "AI extraction tools give me a JSON blob and no way to check it. When it's
  wrong on a value, I find out at liquidation."
- "Our people re-type the commercial invoice into the entry. Every time."
- "I want to ask 'which shipments are at risk and what's the dollar exposure'
  without building a report — and I need the number to be *right*."
- "Every AI chatbot I've seen bolted onto a compliance tool is a liability. It
  sounds confident and it's guessing."
- "If the model classifies a product, who's accountable? Where's the audit trail?"

---

## Feature → what the customer gets → how to show it

### Document Intelligence

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Upload is instant; parsing is durable** | The upload request validates, stores the immutable original, hashes it (SHA-256), creates one durable processing run, and returns — nothing expensive happens in the user's request. Everything after survives a restart. | `/app/documents` → upload a commercial invoice. It's accepted immediately; the processing status advances in the background. |
| **IBM Docling parsing + Gemini extraction** | Layout-aware parsing (tables, sections, OCR fallback) via IBM-hosted Docling, then structured field extraction. Qubere owns the domain; Docling is a swappable provider behind a versioned contract. | Open a processed document → **Extraction** view. Show the extracted header fields, line items, parties. |
| **Field-level provenance** | Every extracted fact carries its value **plus** the page number and bounding box it came from, chained: customs field → extraction field → document section/table id → parser element ref → page + bbox → canonical artifact → original document. Absence is preserved — a null page means the parser didn't report one, never a default. | On an extracted field, click through to the source — highlight on the page image. This is the "we prove every line item" moment. |
| **Four separate confidence signals, never merged** | Parser confidence, OCR confidence, the extraction model's own confidence, deterministic validation status, and human review status are five distinct things. "Not measured" is never shown as zero. | Show a field where parser confidence is high but the model flagged low extraction confidence — the two don't get averaged into a fake number. |
| **Quality gate with bounded escalation** | A parse becomes the document's active version only if it passes an objective gate (text coverage, blank-page counts, parser warnings). Insufficient text → automatic OCR retry (STANDARD → OCR_FALLBACK → FULL_PAGE_OCR) → then a person. No invented score. | Show a scanned/image PDF driving the OCR escalation path and landing in **Needs Review**. |
| **Reconciliation across documents** | Extracted facts from the commercial invoice, packing list, and bill of lading are cross-checked; conflicts become `ReconciliationIssue` / `ExceptionItem` records that block filing until resolved. | Open a shipment with a value mismatch between two documents → the reconciliation issue and its blocking status. |
| **Client email intake with explainable matching** | With client addresses enabled, the destination identifies the client. Clean attachments enter the existing parsing pipeline; one confident shipment match can attach, while unknown senders, conflicting identifiers and unreadable files wait for broker review. | **Document Email** → copy a client address, then `/app/documents/inbound-review` → compare the candidate shipment identifiers before choosing **Attach document**. No shipment is preselected. |
| **Immutable, auditable, malware-screened** | Original bytes are never mutated, every read re-verifies the hash, uploads are malware-scanned (configurable block vs advisory), and every step writes to `AuditLog`. | Explain the SHA-256-on-every-read guarantee; show the audit trail on a document. |

### Ask Qubere (the assistant)

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Natural-language front door to the whole platform** | ~70 tools spanning shipments, value-at-risk, filing readiness, classification, HTS/duty lookups, parties & products (with change history and evidence), restricted-party / embargo / RDPS / community screening, decisions, exceptions, regulatory notices, rulings, drawback, protests, dashboard metrics, team roster. | `/chat` → *"Which shipments are at risk and what's the dollar exposure?"* Answer streams in as text **plus a linked table** — every row a real shipment. |
| **Answers are the same numbers the dashboard computes** | The assistant is a client of the existing application layer, not a second source of truth. "At risk" / "value at risk" come from the same computation the Command Center uses — if chat's number ever disagreed with the dashboard's, that would break the whole pitch. | Ask for value-at-risk in chat, then open `/app/dashboard` and show the identical figure. |
| **Evidence, not prose** | Any claim that names a specific shipment/decision/exception renders as a linked reference. If the model can't back a number with real rows, it doesn't state the number. | Ask *"what's critical today?"* → click a result row → lands on the real shipment page. |
| **RBAC enforced before the model sees the tool** | Each tool declares the nav route or permission it needs. The registry is filtered to what the caller may use *before* it's offered to the model, and the orchestrator re-checks the tool name before executing. A model that names a tool it was never offered still can't run it. A PLANNER asking "show all shipments" gets the same row-level filter the Shipments page applies — same code path. | Log in as `sarah@target.com` (PLANNER) and as `admin@target.com`; ask the same question; show the different result sets. |
| **Write actions, with a confirmation step** | The assistant *can* create a shipment, classify a product, approve/reject a decision, resolve an exception, and trigger a rescreen — each gated by its specific permission (`shipments.create`, `decisions.approve`, `exceptions.resolve`, …), each writing to `AuditLog` tagged assistant-initiated, and each behind an explicit "here's exactly what will happen — proceed?" confirmation the button UI doesn't even have. | Ask *"create a shipment for importer ABC Manufacturing"* → it asks only for the one hard requirement, shows a summary card, waits for confirmation, then hands back the new shipment number and link. |
| **Origin safety** | A dedicated tool surfaces a product's legal country-of-origin position. The system prompt forces the model to quote it verbatim and forbids substituting a manufacturing / supplier / ship-from / export country when no approved determination exists — even if the tool's own fields mention one. | Ask *"what's the country of origin for product X?"* on a product with no approved determination → it says so, it doesn't guess. |
| **Bounded cost** | At most 6 tool-calling rounds per turn; 15 questions/min per user, 60/min per account; a shared per-account daily token ceiling. Provider token counts recorded per round for spend attribution without a separate billing export. | Explain the guardrails to a technical buyer; show the rate-limit response is a plain 429, not a crash. |
| **Grounding discipline** | Retrieved business content (extracted document fields especially) enters the model's context inside a labelled data envelope and is never treated as an instruction. | Talking point for security review — this is prompt-injection defense on untrusted document text. |

---

## Talking points

- **"Every field has a page and a box."** Open the provenance highlight. No other
  extraction tool in this space shows the customer *where on the document* a
  declared value came from.
- **"The assistant can't launder a decision."** Same permissions, same audit
  log, plus a confirmation step. "Who approved this" stays honest whether the
  click came from a button or a sentence.
- **"Not measured is not zero."** The four-confidence model is the anti-BS
  design — Qubere refuses to average real and missing signals into one
  reassuring number.
- **"One AI surface."** An earlier standalone copilot panel was deleted outright
  and its guardrails folded in — there is exactly one AI surface to audit, not
  three.

## Objection handling

- **"Which model? Are you sending our data to OpenAI?"** The reasoning model is
  Gemini (3.6 Flash default); Claude is wired as an alternative provider for the
  assistant and a few advisory routes. Document parsing is IBM Docling. Model
  choice is per-surface config, and provenance records which model actually ran.
  No OpenAI.
- **"What if the AI is down?"** Every workflow is fully usable without it. With
  no model key configured, the assistant route says so rather than answering
  from nothing, and agent calls fail closed rather than fabricating.
- **"Does the assistant have full conversation memory / cross-session history?"**
  Turns are audit-logged (question, outcome, counts — never tool arguments or
  answer prose). Rich persisted multi-session memory is not the current shape —
  it's a deliberate decision for a regulated product, not a missing feature.
- **"Can it read our whole database?"** No. It calls a fixed registry of tools,
  each running with the caller's real session context. The model never sees SQL,
  an internal API, the page DOM, or an account ID.

## Demo setup

For email intake, use the [client email demo](../../../sales/CLIENT-EMAIL-INGESTION-DEMO.md).
Its synthetic fixtures exercise clear, conflicting and unknown-sender cases.
The seed supplies known text to the matcher; completed extraction requires the
real parser worker. A shipment match does not approve extracted fields, publish
Entry Proof or submit a filing. Client email requires a clean malware scan even
when other upload paths use advisory policy.

`GEMINI_API_KEY` must be set for the assistant and agents; `DOCUMENT_PARSER_PROVIDER=ibm-docling`
(+ Docling creds) for real parsing — the hosted demo has these. Have one shipment
with fully processed documents to show provenance, and use the Command Center /
chat value-at-risk comparison as the trust proof.

**Deeper reference:** `docs/document-intelligence.md`, `docs/ai-chat-interface.md`
(design spec — the built shape is in README §9), README "AI Cost Controls" and
"AI Model Selection".
