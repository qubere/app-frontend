# Partner portal: five-minute Entry Proof demo

## Prepare a non-production environment

Apply migrations and generate Prisma with the application's normal deployment configuration.
The seed refuses production mode, the production app hostname, and existing accounts outside
DEMO/SANDBOX. It writes synthetic reference data, so use an isolated demo database.

```bash
npm --workspace @qubere/db run db:migrate:deploy
npm --workspace @qubere/db run db:generate
npx tsx --tsconfig apps/custom/tsconfig.json apps/custom/scripts/seed-partner-portal-demo.ts
# Reconcile existing onboarding contacts/documents without sending invitations:
npx tsx --tsconfig apps/custom/tsconfig.json apps/custom/scripts/backfill-client-setup.ts --account-id <existing-account-id>
# Two separate terminals:
npm --workspace @qubere/custom exec -- next dev -p 3001
npm --workspace @qubere/portal run dev
```

Supply DATABASE_URL/DIRECT_URL for that database and the usual Clerk/storage configuration.
A database user record does not create a Clerk identity: use existing matching identities or
accept a broker-issued portal invitation. Target uses porter@target.com; Amazon uses
porter@amazon.example. Use separate browser profiles for the two clients.
The seed adds an active TMS workspace so the same assigned shipment is also visible in
Freight. For shipments without an existing journey, it creates a synthetic four-leg route
with completed, in-transit, and planned legs, carrier references, and milestone events.
Existing routes and workflow progress are preserved.

The seed uses the same proof generation/publication and setup services as the API. Rerunning
creates another immutable proof version. It disables demo stakeholder email delivery.

## Open the shipment workspace

In either **Shipments** or **Freight**, click the shipment number. The separate Action
column is removed. Tabs sit directly below the shipment heading. **Overview** is the
landing tab, with **Filing progress**, the **Shipment milestones** route stepper, and leg
cards first. Choose **Tracking** (or **View tracking details**, which opens and focuses
the Tracking panel) for references,
planned/estimated/actual dates, carriers, and milestone history. Choose **Filing data**
for entry identity and broker-published entries. Expand **Show published line items**
on an entry to load its lines. Requests, documents,
invoices, and Entry Proof remain on this same shipment page.

### Shipment navigation and loading demo

| Feature | Customer benefit | How to demo |
| --- | --- | --- |
| Top tabs and Filing progress landing | Find the shipment's current stage immediately | Click a shipment number; Overview shows Filing progress below the tab bar. |
| Working Tracking shortcut | Reach carrier references and events without searching down the page | Click View tracking details; Tracking becomes selected and its panel receives focus. |
| On-demand tab data | Open shipment progress without waiting for every document, invoice, or proof | Open Documents or Invoices; each fetches 50 records per page. Use Next/Previous and switch away/back. Loaded pages are reused while the shipment is open. |
| Published lines on demand | Inspect a filing without loading every entry's evidence upfront | Open Filing data, then Show published line items for one entry. |

The initial page and At a glance start in parallel. Neither transfers full proof JSON
from the database. Cost summaries use published totals plus a database-computed duty
completeness flag. Actual latency depends on authentication and database/network time;
no production latency improvement has been measured in this environment.

## If porter@target.com sees empty data or a loading error

1. Pull this branch and run `npm install` from the repository root to link new workspace
   packages such as `@qubere/entry-proof`. Apply any pending migrations, regenerate Prisma,
   and restart the dev processes. `db:generate` does not install or link workspace packages.
   Existing assigned actions do **not** need reseeding. The reported `db.entryProof.aggregate`
   failure means the running Prisma client did not contain the new model. Optional summary
   failures no longer prevent `/api/dashboard` from returning existing actions.
   `Unknown argument customerActionable` also indicates a stale generated client. Stop all
   dev processes **before** regeneration and restart them afterward: hot reload preserves
   the Prisma singleton and is not sufficient. Prisma version `6.19.3` can be identical
   before and after regeneration; its version does not identify the generated schema.
   Setup now reports the same update-required response for missing new relations/models.
   The `/api/proofs` endpoint returns
   `503 PORTAL_SCHEMA_OUTDATED` for a stale client or missing proof tables/columns, rather than silently appearing as an empty list.
2. While signed in, open `/api/me?refresh=1` on the **portal** origin. Its `account.id`,
   `account.name`, and `account.dataMode` identify the active account; `clients` lists the
   permitted clients. `PRODUCTION` describes the account dataset, independently of local
   development or `NODE_ENV`. The portal uses the authenticated account mode; the database
   layer defaults to PRODUCTION if mode context is absent. Do not change an account to DEMO
   merely to suppress an error. Match that account to the demo seed;
   the seed defaults to `demo-account`, which may differ from an existing user's account.
3. For a different existing DEMO/SANDBOX account, use:
   `npx tsx --tsconfig apps/custom/tsconfig.json apps/custom/scripts/seed-partner-portal-demo.ts --account-id <account.id>`.
   Use only an isolated demo database. The seed grants the Target identity access to the
   Target client in that account; it does not bypass login or change the active account.
4. Confirm `/api/dashboard` contains `actionItems`, `/api/shipments` contains Target's
   shipment, and `/api/proofs` returns published entries. A successful empty array means
   no records have been published in that scope. For a failure, capture the HTTP status
   and JSON error code; the server log contains database-update details.

The portal now establishes the account's DEMO/SANDBOX/PRODUCTION context before reading
shipments, actions, conversations, documents, or invoices. This fixes demo data being
filtered out by the default production context. Authenticated access and client scope
are still enforced.

## 0:00–1:15 — Proof alongside your broker

Open Target shipment SHP-TGT-2026-001 and its Entry Proof, ENTRY-TGT-24001. Expand the
review line. Point out the approved HTS code, reference release, origin, fee breakdown,
review reason, and evidence. The $4,400 is **identified potential savings**, not an approved
refund. The score describes review coverage; it does not certify legal compliance or clearance.

Say: “We already have a broker.” — Exactly. Entry Proof rides alongside them.

## 1:15–2:00 — A score you can inspect

Open Compliance. Sort by score and savings; follow the entry link. In a separate Amazon
session, open ENTRY-ACM-24002. Line 1 has an unapproved material classification. Line 3
shows AD/CVD data unavailable for A-570-042. A missing company rate is never presented as
an evaluated zero. The two sessions must not expose the other client's entries.

## 2:00–3:00 — Answers and a tracked question

Open Amazon shipment SHP-ACME-2026-002. At a glance shows the two-day ETA slip, published
duty/fees plus explicitly visible charges, the FDA hold, last free day, and a customer deadline.
Invoice totals are separate from the cost estimate to avoid double counting. Unknown measures
keep the estimate marked partial. Clearance timing is not invented.

Expand proof line 3 and ask “Which manufacturer information would resolve this rate?” Follow
the resulting Actions conversation. The request records the exact proof version and line.
Return to the broker filing's Entry Proof tab, refresh, and publish. The prior publication
remains customer-visible while the draft is prepared, then is superseded atomically.

## 3:00–4:15 — One setup view

Open Target Setup: completed registration, masked EIN, CBP number, bond, signed POA,
accepted 5106, documents, stakeholders, and broker team. Download the **synthetic demo**
signed POA. In Amazon Setup, show the pending signature and incomplete steps.
An admin can request access for a colleague; the broker reviews the request and issues the
actual scoped invitation. Saving a stakeholder never silently sends an invitation.

### Upload a signed PoA and verify it as the client

In the broker app, open **Clients and Importers → Powers of Attorney (POA)** (or the
Importer of Record tab), find the importer linked to Target, and choose **Upload Signed
POA**. Upload a signed PDF, PNG, or JPEG. The file is stored and its executed PoA and
client-visible document are saved together. An unlinked importer can retain its PoA,
but the UI explains that a client link is required before it can appear in the portal.

As porter@target.com, open **Your setup**, select Target if prompted, and choose **Refresh
setup**. The PoA appears in **Power of Attorney** and **Documents on file**. Returning to
the portal window also refreshes Setup. Download the document and compare it with the
uploaded file. A newer signed upload for the same importer takes precedence over an
older onboarding draft in this customer view.

The old importer-upload endpoint expected JSON while both upload forms sent multipart
files; it also used an Active status/placeholder path and did not publish a portal
record. Uploads through that old path may need to be repeated once after updating.
Do not backfill a placeholder path as though it were a signed document.

### Customs shows setup complete, but the portal shows no setup

The client selected on the onboarding case must be the same **client record** assigned
to the portal user. Similar names are not an ownership link: `target` and
`Target Corporation` can be different clients under the same broker account.

| Feature | Customer benefit | How to demo |
| --- | --- | --- |
| Onboard an existing client | Keep setup, shipments and portal access on the same customer record. | In Customs, start onboarding, keep **Existing client**, search for **Target Corporation**, and select it. Choose **New client** only for a genuinely new customer. |
| Correct the portal client on an existing case | Recover saved setup and signed documents without uploading the PoA again. | Open the existing Customs onboarding case. Under its header choose **Update client link**, select the client assigned to `porter@target.com` (the screenshot shows **Target Corporation**), and choose **Save client link**. If the correct client is already selected, save it again to repair missing importer links and republish saved documents. |
| Consistent readiness in both apps | Clients see what the broker has actually completed and what remains pending. | As Porter, open **Your setup → Refresh setup** and select the same client. Verify company details, executed PoA, verified bond and screening; a submitted/accepted Form 5106 or an explicit waiver completes importer registration. Activation remains pending until the broker activates the case. |
| Download the existing signed PoA | No repeat signature or upload for an already stored onboarding document. | Open **Power of Attorney → View signed POA**, or **Documents on file → Download**, and compare with the broker's saved signed file. |

When moving an unactivated case from an unused duplicate client, review **Billing &
access** for the selected client before activation. The old client's confirmation is
not reused. The correction does not move logins, invitations, requests, shipments, or
invoices, and refuses to move an activated case or an importer already in operational
use. Existing client documents retain their visible/revoked state. No name or email
matching, client merging, or account data-mode change occurs.

All linked importers appear even without onboarding cases. When no importers are
linked, the portal says **No importers on file**. It no longer invents “POA awaiting
signature” for an unlinked client. This is separate from a failed upload through the old multipart bug:
an executed onboarding PoA with saved bytes does **not** need re-uploading.

## 4:15–5:00 — Broker controls and notifications

Open the broker client's Portal & setup panel. Show login status, documents, and invitation
controls. The existing authenticated compliance-notification cron reconciles committed
customer events into an idempotent email/bell queue. Stakeholder preferences control event
and channel delivery; both active membership and client assignment are required.

## What is live and what remains a stub

- Implemented: scoped proof publication, line questions, deterministic shipment answers,
  onboarding promotion, setup downloads, stakeholder access requests, notification integration.
- Downloadable signed POA/accepted 5106 content comes from stored files. No unsigned POA
  template is promoted as an executed document. Demo PDFs are visibly synthetic.
- Generated 7501 and invoice PDF downloads remain the existing stubs. Do not demonstrate
  them as working generated documents. No ABI/ACE transmission or entry-number assignment.
- OpenSign completion requires OPENSIGN_WEBHOOK_SECRET in the app and the matching
  x-qubere-webhook-secret header on delivery. Signed bytes are fetched through the configured
  provider before promotion. Dropbox Sign's existing provider remains a stub.
- This change does not configure Clerk, a database, object storage, cron scheduling, or email
  credentials. Validate these integration settings before a customer demonstration.

## Complete client workspace: shipments, documents and importers

| Feature | Customer benefit | How to demo |
| --- | --- | --- |
| Shipments across all linked importers | A subsidiary's shipment remains visible when ownership is recorded on its importer rather than directly on the shipment. | As Porter, open Shipments and search for `SHP-2026-000001`, then `SHP-2026-000002`. Open each shipment number. Both must belong to an assigned client directly or through an explicit importer/case link. Use Next/Previous for additional pages. |
| Workspace documents with Uploaded by | Find broker-shared and client-uploaded files together, and identify who supplied them. | Open Documents Vault, click Refresh documents, and check Uploaded by, shipment number, source and date. Open an invoice and an executed PoA. Load more documents to reach older files. Uploader history comes from upload audit events or the original inbound email; Not recorded means historical attribution is absent. |
| Every importer under the client | See each legal entity's readiness, PoA and bond without switching client workspaces. | Open Your setup, choose the authorized client if prompted, and refresh. Under Importers of record, show each entity's identifiers, registration, signed PoA, bond and screening. An importer created outside onboarding appears as On file. |
| Independent importer progress | Avoid confusing one entity's signed PoA or 5106 with another entity's incomplete setup. | Compare two importers in the same client. Complete or submit a requirement for one; refresh and verify the other retains its own status. A client-wide completion indicator requires all importers to be complete. |
| Switch between authorized clients | An empty client record no longer hides the client selector. | With two assigned clients, choose one in Your setup, then use the same selector to open the other. The selector stays visible even when the first client has no importers. |

This view includes customer-visible files across the authorized client workspace;
broker-internal and other-client documents remain restricted. It does not infer client
ownership from similar company names. If a specific shipment is still absent, check its
direct client and importer client links in Customs. The live user's records were not
available during automated verification, and the fixes do not relink those records or
reseed their shipments automatically.

For an empty Setup result, an operator can run
`npm run portal:diagnose -- --email porter@target.com` from the repository root
using the portal's database environment. If prompted, add `--account-id` with the
account selected in the portal. This read-only report identifies assignments,
importer/case links, PoA states, document counts and the two reported shipment
numbers. See the README for scope, limits and how to read it. It is an operator
diagnostic, not a customer-facing report or automatic repair.
