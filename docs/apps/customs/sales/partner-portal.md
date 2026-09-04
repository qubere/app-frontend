# Partner Portal — sales demo guide

**One-liner:** Qubere gives a broker's importer clients (or an enterprise's
suppliers) their own authenticated, client-scoped window into their shipments,
documents, entries, and invoices — and turns "chasing the customer for the
packing list" into a tracked request the customer answers in the portal, with the
uploaded document flowing straight into the same document-intelligence pipeline.

**Who to sell it to:**

- **Customs brokers** — the differentiator their clients actually feel. "Where's
  my entry?" and "did you get my invoice?" stop being phone calls.
- **Enterprise importers** — a supplier-facing portal for document collection and
  origin/compliance data, scoped so a supplier sees only their own POs.

> **Maturity note:** the portal is a real, authenticated, client-scoped
> application (Clerk identity, object storage, tenant scoping enforced on read
> paths) suitable for **design-partner / pilot** deployment. Generated 7501 /
> invoice **PDF downloads now render real content** — a real itemized invoice
> PDF and a real CBP Form 7501 built from the filing's frozen snapshot (header
> totals, per-line description/HTS/value/COO). One honest limit: per-line duty
> rate/amount are left blank on the portal-generated 7501 rather than
> recomputed, since the portal doesn't run the tariff duty engine that produced
> the original figures — point to the broker-side 7501 Preview for that detail.

---

## The problem, in the customer's words

**Broker:** "Half my team's day is email. 'Send me the commercial invoice.' 'Any
update?' 'Can you resend the invoice?' Every client, every shipment."

**Broker's client:** "I have no idea where my shipment is unless I email my
broker and wait. I get a PDF invoice with no context."

**Enterprise:** "Collecting origin declarations and certificates from 200
suppliers is a shared mailbox and a spreadsheet."

---

## Feature → what the customer gets → how to show it

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Client-scoped portal login** | The customer signs in and sees only *their* shipments, documents, entries, and invoices — scoping is enforced on every read path, not just hidden in the UI. | Portal app → sign in as a seeded portal user. Show the dashboard scoped to one client. Contrast with a second client's login. |
| **"Ask the customer" request workflow** | The broker raises a document/data request against a specific shipment from `/app/clients`; the customer gets an email, opens the request in the portal, and answers or uploads. Status tracked end to end. | Broker side: `/app/clients` → raise a "Upload Bill of Lading" request on a shipment. Portal side: open the request, upload a file, mark it answered. Broker side: the request shows resolved. |
| **Uploaded documents flow into the pipeline** | A document the customer uploads through the portal isn't just a file in a folder — it enters the same parse → extract → reconcile → readiness pipeline as a broker upload. | After the portal upload, show it appearing on the shipment in `/app/documents` with processing status. |
| **Shipment visibility** | Per-shipment status, milestones, and the journey — what the customer would otherwise call to ask. | Portal → **Shipments** → a shipment detail with status and route. |
| **Entry / filing visibility** | The broker chooses when an entry becomes customer-visible (`customerVisibleAt` is an explicit publish action — nothing leaks early). | Broker: publish a filing to the customer. Portal: the entry now appears under the customer's shipment. |
| **Invoices** | The customer sees their invoices in the portal with the shipment context behind each one, and can download a real itemized invoice PDF. | Portal → **Invoices** → download the PDF. |
| **Freight view** | A freight/movement summary for forwarding-style relationships. | Portal → **Freight**. |
| **Passwordless invite & onboarding** | The broker sends a scoped invitation (`/invite/<token>`); the customer accepts and is provisioned with access limited to their client and, optionally, specific product scopes. | `/app/clients` → invite a portal user with a client + product scope. Show the invite acceptance flow. |
| **Client document email address** | When enabled, customers copy the address for their assigned client from Setup or Documents. The destination routes the file to that client; a sender's other client relationships do not decide where it belongs. | Portal → **Setup** or **Documents** → copy the labeled client address. Users assigned multiple clients choose the correct client's address. |
| **Emailed document status** | Customer-visible emailed files show whether they are Processing, Attached to a shipment, or With your broker. Internal and discarded inbound files remain hidden; access follows the customer's assigned clients. | Portal → **Documents** → show the emailed label, sender/date and shipment group. Open the unknown-sender fixture with **With your broker** status. |
| **Published proof stays under broker control** | A new emailed document attached to a shipment with published Entry Proof creates a broker draft. The customer keeps seeing the previous publication until the broker publishes the update. | Broker → attach the fixture and inspect the draft. Portal → confirm the previous published proof remains visible. |

---

## Talking points

- **"Your clients stop calling to ask where things are."** The portal is the
  answer to the two questions every broker fields all day.
- **"Chasing a document is now a tracked request, not an email thread."** And the
  document the client uploads does real work the moment it lands.
- **"Nothing leaks early."** Entry visibility is an explicit publish action by
  the broker — the customer sees what you decide, when you decide.
- **"Scoped, not filtered."** For a technical/security buyer: client scope is
  enforced server-side on every read path, and the portal runs as its own
  origin.

## Objection handling

- **"Does 'received' mean ready for filing?"** No. Receipt, processing, shipment
  attachment and broker approval are separate. **With your broker** means a
  decision is still needed. Under Approved senders only, an unknown email is held
  before attachment download, so its files do not appear until approved and scanned.
- **"Will every sender get an email receipt?"** Replies default off and need
  both deployment and address-level enablement. Loop suppression can skip a reply,
  and failed or timed-out attempts are not automatically retried. Show the portal
  document status instead of promising delivery of a receipt.
- **"Is this production-ready?"** It's pilot-ready. The security model (auth,
  client scoping, object storage) is real and was hardened through a formal
  review, and generated-PDF downloads now render real content. The remaining
  gap is broader automated two-tenant test coverage — fine for a design
  partner, worth being explicit about for a large rollout.
- **"Can we brand it?"** The portal uses the Qubere design system today. Custom
  branding per broker is a roadmap item, not current.
- **"What can the customer NOT do?"** They can't see other clients' data, can't
  see unpublished entries, can't take compliance actions, and can't reach the
  broker's internal workspace. It's a read + respond surface.
- **"How do suppliers fit the enterprise story?"** Same mechanism — an
  invitation scoped to a party and product scopes — used for supplier document
  and origin-data collection rather than importer status visibility.

## Demo setup

For the client email story, follow the
[client email demo](../../../sales/CLIENT-EMAIL-INGESTION-DEMO.md) after the
[Entry Proof partner demo](../../../sales/PARTNER-PORTAL-ENTRY-PROOF-DEMO.md).
Client addresses must be enabled in both apps. Use the
[customer instructions](../support/CLIENT-EMAIL-DOCUMENTS.md#send-documents-as-a-customer)
for the handoff after the demo.

The portal deploys as a separate app (`apps/portal`). On the hosted demo it's
available; locally, run it alongside the customs app. Seed portal users and
client-scoped shipments; use the broker login (`admin@target.com`) on the customs
side and a seeded portal user on the portal side. Have one shipment with an open
customer request to show the round trip.

**Deeper reference:** `docs/plans/review/CUSTOMER-PORTAL-PR97-REVIEW.md` (the full
review, fix status, and remaining open items).
