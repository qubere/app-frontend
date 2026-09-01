# Document Management & Recordkeeping — sales demo guide

**One-liner:** Qubere is a customs recordkeeping system that happens to also read
your documents — every uploaded original is stored immutably, hashed, and
verified on every read; every extracted fact traces back to a page and a box; and
one click assembles the audit package CBP would ask for, so 19 U.S.C. § 1509
recordkeeping stops being a shared drive and a prayer.

**Who to sell it to:**

- **Enterprise trade compliance** — the Reasonable Care and recordkeeping owner.
  "Can you produce the complete file for entry X from three years ago, with
  provenance?" today is a scramble.
- **Brokers** — the document chase, the "which version of the invoice is
  current," and the audit-response fire drill.

---

## The problem, in the customer's words

- "Our trade documents are in email, a shared drive, and the broker's system. No
  single index."
- "Someone sent a revised commercial invoice. Is it the one we filed on? Nobody's
  sure."
- "CBP recordkeeping is five years. Our process for that is 'don't delete the
  folder.'"
- "A CF-28 / audit request lands and we spend two weeks assembling the file."
- "We can't prove a document wasn't altered after the fact."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Immutable original + SHA-256** | The uploaded bytes are stored once, never mutated, and the hash is re-verified on **every read**. If a stored document were ever altered, the next read fails the check. | `/app/documents` → open a document → show the checksum and the "verified on read" guarantee. |
| **One document index per tenant** | Every trade document — invoice, packing list, BoL, AWB, certificates — in one searchable place, linked to its shipment(s) and, for multi-leg, its specific leg. | `/app/documents` → search, filter by type/shipment/status. |
| **Versioned processing, active-version pointer** | Reprocessing a document creates a *new* version at a higher number; the "active" version is a protected pointer. A slow old parse that finishes late is kept for audit but never claims the pointer. | Reprocess a document → show version 2 created, version 1 retained. |
| **Field-level provenance** | Customs field → extraction field → parser element → page + bounding box → canonical artifact → original. Absence preserved (null page = parser didn't report one, never a default). | On an extracted value, click to the highlighted spot on the page image. |
| **Inbound email intake** | A per-tenant mailbox: forward/CC documents and they're ingested, classified, and attached to the right shipment through the same pipeline as a manual upload. Allow-list controlled. | `/app/admin/settings` → **Document Email** → the tenant address + allowed senders. Show a document that arrived by email. |
| **Malware screening** | Uploads are scanned; policy is configurable (advisory: accept unscanned / block: quarantine unscanned). Quarantined files are visible and never silently dropped. | `/app/documents` → quarantine view; explain the block vs advisory switch. |
| **Reconciliation & exceptions** | Cross-document conflicts (invoice value ≠ packing list value) surface as tracked issues that block filing until resolved, with structured reasons. | A shipment with a document conflict → the reconciliation issue → resolve with a reason. |
| **Audit room / Reasonable Care package** | One click assembles a Reasonable Care package and a Focused Assessment file for a ±7-day window around a filing — the declaration, the classification decisions with evidence, the documents, the timeline. Exportable. | On a filing → **Generate Audit Package** → walk the contents. |
| **Compliance record export** | Every compliance audit run is timestamped and exportable as evidence of importer due diligence — the § 1484 Reasonable Care record. | `/app/compliance` → **Export Compliance Record**. |
| **Document exports** | Bulk export of shipments and documents for a client, a period, or an audit scope. | `/app/documents` or the exports routes → export a set. |
| **Everything audit-logged** | Upload, reprocess, attach, view, quarantine, export — every action writes an immutable `AuditLog` entry (accountId, userId, action, entity, IP, user agent, request id, outcome). | Show the audit trail on a document and on a shipment. |

---

## Talking points

- **"This is a recordkeeping system first."** The parsing is valuable, but the
  defensible bit is: immutable originals, hash-verified reads, versioned
  processing, and a one-click audit package. That's the § 1509 answer.
- **"Hash-verified on every read"** is a sentence that lands with an enterprise
  compliance or IT buyer. It means tamper-evidence, not just storage.
- **"The audit response is a button."** Show the audit package assembling. The
  before-state is two weeks of a person; the after is one click and a ±7-day
  evidence bundle.
- **"Absence is preserved."** Qubere never synthesizes a bounding box or a page
  number to look complete. A missing signal stays missing.

## Objection handling

- **"Do you replace our DMS / SharePoint?"** For trade documents, yes — and with
  provenance and audit-packaging those systems don't have. It's not a general
  enterprise content platform.
- **"Retention policy / legal hold?"** Originals are immutable and audit-logged.
  Formal retention-schedule automation and legal-hold workflow are not
  first-class features yet — the guarantee today is "nothing is mutated or
  silently deleted."
- **"What formats?"** PDF is the primary path (born-digital and scanned, with OCR
  escalation). Images are supported. Office formats go through the same provider
  where the parser supports them.
- **"Can we bulk-import our back catalog?"** Documents can be uploaded in bulk;
  extraction runs on each. There's no dedicated historical-archive migration
  tool — scope that as a services engagement for a large back-file.

## Demo setup

`DOCUMENT_PARSER_PROVIDER=ibm-docling` (+ creds) and `BLOB_READ_WRITE_TOKEN` for
real storage — the hosted demo has these. Run `seed-inbound-demo.ts` for the
email-intake demo. Have one shipment with multiple processed documents (to show
provenance and reconciliation) and one filing (to show the audit package).

**Deeper reference:** `docs/document-intelligence.md`,
`docs/compliance-notifications-and-audit.md`, README §5 (audit logging).
