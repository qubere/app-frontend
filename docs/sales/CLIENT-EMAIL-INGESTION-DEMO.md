# Forward documents and resolve only the exceptions

Use a DEMO or SANDBOX workspace with the Entry Proof partner demo already seeded.
All fixtures are synthetic. Never run these commands against a production account.

## Sales conversation

**Open with:** "Give each client one document address. Clear shipment matches
attach automatically; your broker sees the sender and matching evidence when a
decision is needed."

Ask where the team loses time today: identifying the client, finding the shipment,
checking a new sender, or answering "did you receive it?" Then demonstrate that
specific handoff. In the conflict example, pause on the shipment identifiers and
empty selection before attaching. The broker can verify the decision without
switching between several screens.

| Customer question | What to demonstrate and say |
| --- | --- |
| "Can one forwarder send for several clients?" | Copy the destination for each client. The address determines the client; sender rules authorize intake for that destination. |
| "What happens when the shipment is unclear?" | Open Email review with two candidates. The broker chooses explicitly; the system does not pick the latest shipment. |
| "Does received mean ready to file?" | Show Processing, With your broker and Attached to a shipment as distinct states. Attachment does not approve extracted fields or submit a filing. |
| "Will new evidence change what my customer sees?" | Show the new Entry Proof draft beside the previously published version. Publication remains a broker action. |
| "Can we turn this on immediately?" | The feature defaults off. Complete domain, scanner, storage, parser and sandbox checks in the rollout guide first. |

Customer handoff: [send documents and understand their status](../apps/customs/support/CLIENT-EMAIL-DOCUMENTS.md).

## Prepare

From the repository root, seed the prerequisite (its env loader uses this directory):

```bash
npx tsx apps/custom/scripts/seed-partner-portal-demo.ts --account-id DEMO_ACCOUNT_ID
```

Configure the inbound domain/flag, durable storage and ClamAV as described in the
[rollout guide](../operations/CLIENT-EMAIL-INGESTION-ROLLOUT.md). Set
`ALLOW_DEMO_SEEDING=true` in the sandbox. Keep `INBOUND_AUTO_REPLY_ENABLED=false`.
Then run:

```bash
npm --workspace @qubere/custom run seed:inbound-email -- --account-id DEMO_ACCOUNT_ID
```

The seed prints the real issued addresses and document IDs. Addresses use random
80-bit tokens and remain stable on reruns; it does not install predictable tokens
on a real inbound domain. Fixture event IDs are deterministic, so reruns resume
rather than create duplicate documents. To present a fresh decision, use a fresh
sandbox account. Resolved decisions are deliberately not reopened.

No email is sent or fetched from Resend. The seed injects three local PDFs through
the actual inbound worker, scanner, storage, parse queue and matching/review hooks.
The normal parser remains queued; matching also receives the fixture's known text.

## Five-minute walkthrough

1. **Start in Target's setup.** Copy its client-specific address. Explain: "Forward
   your invoice and include the shipment number. Clear matches attach automatically;
   your broker checks anything uncertain."
2. **Show the easy case.** `porter@target.com` sends `target-invoice.pdf` for
   `SHP-TGT-2026-001`. Open that shipment and the portal Documents tab. The new file
   is labeled as emailed. In the broker workspace, show the fresh Entry Proof DRAFT
   with an inbound-document evidence reference. The customer still sees the
   previously published proof until the broker publishes the updated version.
3. **Show the ambiguous case.** The fixture from `trade@amazon-import.test`, `amazon-conflict.pdf`,
   references container `CBHU8842190`, used by two Amazon shipments. Open Documents → Email
   review. Both shipment candidates and their matching identifiers remain visible.
   Preview the document, explicitly select the correct shipment, then attach.
4. **Show a new sender.** `logistics@freightco.example` sends
   `amazon-unknown-sender.pdf` to Amazon's REVIEW address. The file is scanned and
   visible in Portal with "With your broker" status. The broker sees "Check sender"
   and must verify it before attaching. Approval of this item does not silently add
   that sender to the permanent approved list.
5. **Close with control.** In Settings → Document email, show per-client copy,
   approved sender policy, suspension and rotation. Mention that rotation gives
   customers 30 days to switch and every decision is audited.

## Expected fixture outcomes

| Fixture | Client | Expected result |
| --- | --- | --- |
| target-invoice.pdf | Target | Attached to SHP-TGT-2026-001; new proof DRAFT |
| amazon-conflict.pdf | Amazon | MATCH_CONFLICT; two container matches |
| amazon-unknown-sender.pdf | Amazon | UNKNOWN_SENDER; portal-visible review item |

Target's destination uses ALLOWLIST and permits `porter@target.com`. Amazon's
uses REVIEW and permits `trade@amazon-import.test`; the logistics sender remains
unknown. If an existing demo address has a different policy, set those policies
in Settings before running. Existing policy changes are intentionally preserved.

If a fixture fails before document creation, check scanner connectivity and storage
configuration. No unscanned file is accepted by client-address intake. Parser status
may remain pending until the document worker runs; the deterministic fixture match
is separate from completed extraction, and the UI must not claim parsing succeeded.
