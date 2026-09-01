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
> paths) suitable for **design-partner / pilot** deployment. One honest gap
> remains: generated 7501 / invoice **PDF downloads still return stubs** (no PDF
> rendering library in the stack yet) — real document downloads (the originals)
> work. Don't demo the "download your entry summary as a polished PDF" flow.

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
| **Invoices** | The customer sees their invoices in the portal with the shipment context behind each one. | Portal → **Invoices**. (Original documents download; generated-PDF download is stubbed — see maturity note.) |
| **Freight view** | A freight/movement summary for forwarding-style relationships. | Portal → **Freight**. |
| **Passwordless invite & onboarding** | The broker sends a scoped invitation (`/invite/<token>`); the customer accepts and is provisioned with access limited to their client and, optionally, specific product scopes. | `/app/clients` → invite a portal user with a client + product scope. Show the invite acceptance flow. |
| **Inbound email to the portal** | Customers can also just email documents to a per-tenant address; they land against the right shipment. | Explain the inbound-email path (shares the intake pipeline from [document-management.md](document-management.md)). |

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

- **"Is this production-ready?"** It's pilot-ready. The security model (auth,
  client scoping, object storage) is real and was hardened through a formal
  review. The remaining gap is polished generated-PDF downloads and broader
  automated two-tenant test coverage — fine for a design partner, worth being
  explicit about for a large rollout.
- **"Can we brand it?"** The portal uses the Qubere design system today. Custom
  branding per broker is a roadmap item, not current.
- **"What can the customer NOT do?"** They can't see other clients' data, can't
  see unpublished entries, can't take compliance actions, and can't reach the
  broker's internal workspace. It's a read + respond surface.
- **"How do suppliers fit the enterprise story?"** Same mechanism — an
  invitation scoped to a party and product scopes — used for supplier document
  and origin-data collection rather than importer status visibility.

## Demo setup

The portal deploys as a separate app (`apps/portal`). On the hosted demo it's
available; locally, run it alongside the customs app. Seed portal users and
client-scoped shipments; use the broker login (`admin@target.com`) on the customs
side and a seeded portal user on the portal side. Have one shipment with an open
customer request to show the round trip.

**Deeper reference:** `docs/plans/review/CUSTOMER-PORTAL-PR97-REVIEW.md` (the full
review, fix status, and remaining open items).
