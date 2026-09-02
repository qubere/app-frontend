# Partner portal: five-minute Entry Proof demo

## Prepare a non-production environment

Apply migrations and generate Prisma with the application's normal deployment configuration.
The seed refuses production mode, the production app hostname, and existing accounts outside
DEMO/SANDBOX. It writes synthetic reference data, so use an isolated demo database.

```bash
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
The seed uses the same proof generation/publication and setup services as the API. Rerunning
creates another immutable proof version. It disables demo stakeholder email delivery.

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
