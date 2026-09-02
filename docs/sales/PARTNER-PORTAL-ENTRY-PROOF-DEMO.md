# Partner portal: customer workspace demo

## Access model

One broker Account holds many customer **client workspaces**. Broker-A serves
Target, Amazon and DHL as separate `Client` records inside the same Account. A
portal user is invited into one client workspace (`UserClientAssignment`) and
sees **all** of that client's data — its importers of record, shipments,
documents, onboarding, setup and requests — including client records whose
`clientId` link is missing or duplicated, which are resolved through an
unambiguous importer-of-record link. A Target user cannot see Amazon or DHL data
even though all three live in the same broker Account. Roles still control
upload, response, billing and filing access on top of the workspace boundary.

## Feature walkthrough

| Feature | Customer benefit | How to demo |
| --- | --- | --- |
| Workspace identity | Know which company's records are being displayed. | Sign in as porter@target.com. The header and sidebar show **Target**, matching the client selected in Customs. `/api/me?refresh=1` exposes the account ID for an operator check. |
| Your client's shipments | Reach older shipments without requiring an explicit client link on every row. | Open **Shipments** and find `SHP-2026-000001` and `SHP-2026-000002`. Click each shipment number. Rows with no `clientId` still appear when their importer of record resolves to Target. Use pagination for older records. |
| Shipment and Freight navigation | Open one shipment page for progress, documents and requests. | Click a shipment number in **Shipments** or **Freight**. There is no separate Action column. Freight includes shipments with an active TMS product workspace. |
| Filing progress landing | See the filing stage as soon as the shipment opens. | **Overview** opens by default. Show Filing progress and the Shipment milestones route stepper with completed, current and upcoming legs. |
| Tracking | See carrier references, dates and shipment events together. | Click **View tracking details**. The Tracking tab is selected and focused. Show references, planned/estimated/actual dates and milestone history. |
| Filing data | Review published entry information without searching another app. | Choose **Filing data**, open a published entry and select **Show published line items**. Lines load only when requested. |
| Requests | Answer the broker in the shipment's context. | Open **Requests** on the shipment or **Actions** in the sidebar. Show an open request, reply with a permitted role, then verify the resulting status. Read-only roles cannot reply. |
| Client documents and Uploaded by | Find files uploaded by both the customer and the broker for that client. | Open **Documents**, click **Refresh documents**, and show shipment number, source, date and **Uploaded by**. Legacy INTERNAL-labelled files on the client's own shipments are included. Load more to reach older files. Open a file and compare it with Customs. Missing uploader history is shown as **Not recorded**. |
| Customs-style setup view | Recognize the same visual language across the broker and customer apps. | Open **Your setup**. Show the numbered progress ribbon, status pills and importer cards, then use the section links to reach Documents, People and Broker team. Refresh keeps the current data visible while loading. |
| Every importer for your client | See onboarding despite missing or duplicate client links. | Open **Your setup**. It defaults to every importer under your assigned client, including the importer named `target` whose `clientId` is empty but whose onboarding case resolves to Target. No relinking is required. |
| Separate importer progress | Avoid confusing one legal entity's readiness with another's. | Compare two importer cards. Each has its own registration, PoA, bond, screening and steps. Complete a requirement for one in Customs, refresh Setup and verify the other retains its status. |
| Existing signed PoA | Retrieve an already executed PoA without repeating signature or upload. | In Setup, verify **Power of Attorney: executed**, signer and signed date. Use **View signed POA** or **Documents on file → Download**. An executed stored artifact is readable even before a ClientDocument was promoted. |
| Optional company filter | Focus the view when a user is assigned to more than one client. | In Setup, select one company, then return to the default view. The selector only offers clients the signed-in user is assigned to; requesting another client returns 404. |
| Entry Proof | Explain classification, duty and evidence behind a published entry. | Open **Entry Proofs**, select an entry and expand a line. Show approved HTS, reference release, origin, fee breakdown, review reason and supporting evidence. Ask a line question with an authorized role. |
| Published cost and invoice summaries | See customer charges without broker margin or buy-cost data. | Open a shipment's **Invoices** tab. Compare published totals with Entry Proof. Unknown duty measures remain marked incomplete; identified savings are potential savings, not approved refunds. |
| Responsive navigation | Use the same customer tasks on desktop and mobile. | Collapse the sidebar to icons, restore it, then open the mobile drawer. Navigate among Actions, Shipments, Documents and Your setup. |
| Client workspace isolation | Keep each customer's records inside their own client workspace. | Sign in as the Amazon client user **in the same broker account**. Try a Target shipment, setup-document and PoA URL. Each must return 404. Return to Target and confirm those records load. |

## Run locally after pulling

From the repository root, install dependencies. Stop existing dev processes before
generating Prisma; hot reload can retain an older Prisma singleton.

```bash
npm install
npm --workspace @qubere/db run db:migrate:deploy
npm --workspace @qubere/db run db:generate
# Start these in separate terminals:
npm --workspace @qubere/custom exec -- next dev -p 3001
npm --workspace @qubere/portal run dev
```

The workspace-scoping change adds no migration and requires no record
reassignment or reseeding. Earlier issue #294 commits add schema and workspace
packages, so apply their pending updates when pulling the branch for the first time.
Existing actions and executed PoAs do not need to be recreated.

An operator can inspect the same account as the portal with:

```bash
npm run portal:diagnose -- --email porter@target.com
# If more than one active account is returned:
npm run portal:diagnose -- --email porter@target.com --account-id <account-id>
```

The diagnostic uses a READ ONLY transaction, reports membership, client
assignments and relationship metadata, and omits credentials, EINs, file
contents and storage URLs. `clientAssignments` in the report **is** the portal
read boundary — a user with no assignment sees nothing. `PRODUCTION` is the
account data mode, independent of localhost or NODE_ENV; changing it is not a
repair for missing client links.

## Synthetic feature fixtures

For an isolated DEMO/SANDBOX database only:

```bash
npx tsx --tsconfig apps/custom/tsconfig.json apps/custom/scripts/seed-partner-portal-demo.ts
```

The seed puts Target and Amazon fixture clients in one demo account, each with
its own portal user assignment — that is exactly the isolation boundary the
portal enforces. Sign in as each user to demonstrate that Target's login cannot
reach Amazon's records and vice versa. The seed does not create Clerk
identities. It refuses production mode and creates visibly synthetic files and
tariff examples. Do not use it to repair the supplied Target records.

## Data loading and known limits

Shipment overview and answers start in parallel. Neither fetches full proof JSON
for first paint. Documents and invoices load in 50-record pages; tracking history
and published filing lines load on demand. Document Vault uses stable cursor
pagination. Live latency has not been measured against the user's database.

Optional proof/setup/deadline failures cannot erase existing action requests. A
failed core request shows an error and retry instead of “No Active Actions Pending”.
A missing Prisma delegate or `Unknown argument customerActionable` requires matching
schema generation and process restart; Setup/Proof report safe update-required
errors for known schema drift.

The supplied read-only diagnostic confirms the Target client relationships;
these changes have not been verified through the user's live authenticated session.
Entry-summary and invoice PDF generation uses the shared billing implementation
merged from main. The existing Dropbox Sign provider remains a stub. Stored signed
PoA downloads are supported. No ABI/ACE transmission is added.
Notification delivery remains opt-in for configured stakeholders through the existing
outbox; viewing client data does not subscribe everyone to every notification.

OpenSign webhooks use the configured `OPEN_SIGN_WEBHOOK_SECRET` in the registered
webhook URL. Existing header adapters can retain `OPENSIGN_WEBHOOK_SECRET`; the
canonical URL configuration takes precedence when both are set. Provider completion
is verified before signed bytes are stored and promoted to Setup.
