# Client email ingestion rollout

Issue #297 adds opaque client destination addresses, explainable shipment matching,
and a broker decision queue. Apply after the document-intake changes and Entry Proof
PR #295. PR #298 is stacked on #295; merge #295 before retargeting #298 to `main`.

## Configuration and deployment

1. Keep `INBOUND_CLIENT_ADDRESSES_ENABLED=false` and `INBOUND_AUTO_REPLY_ENABLED=false`
   while deploying the schema and application. The flags default off when absent.
2. Apply migrations and regenerate the Prisma client with the normal deployment:
   `npm --workspace @qubere/db run db:migrate:deploy` and
   `npm --workspace @qubere/db run db:generate`. The migration preserves existing
   sender rules as account-level rules (`clientId=null`, `scopeKey=''`).
3. Configure the Resend inbound domain/MX and the signed webhook at
   `/api/webhooks/resend/inbound`; retain the existing secret and cron authentication.
   Configure durable document storage, the document parser/worker, and a real ClamAV
   service (`CLAMAV_HTTP_URL`, or `CLAMAV_HOST`/`CLAMAV_PORT`). New client-address
   attachments require a `CLEAN` scan before storage, including in advisory mode.
4. Review the backfill in the intended environment, then apply it:

   ```bash
   npm --workspace @qubere/custom run backfill:inbound-addresses -- --account-id ACCOUNT_ID
   npm --workspace @qubere/custom run backfill:inbound-addresses -- --account-id ACCOUNT_ID --apply
   ```

   Omitting `--account-id` enumerates all non-deleted accounts. The command defaults
   to dry-run and sends no emails. It creates one random operations address/account
   and one random client address/client, reusing current addresses on repeat runs.
   Review the output before publishing the addresses to customers.
5. Enable `INBOUND_CLIENT_ADDRESSES_ENABLED=true` on both Custom and Portal in the
   sandbox. Copy the real address from Settings or the client's setup card. Complete
   the smoke checks below, then enable in the intended production environment.
6. Keep automatic replies off until observing delivery and suppression in a sandbox.
   A reply requires both the global flag and the address's `autoReplyEnabled` option.
   Set a verified `RESEND_FROM_ADDRESS`. Delivery uses a durable claim before sending;
   provider timeouts are not automatically retried, avoiding duplicate receipts.

## Routing and lifecycle

The recipient determines the account/client. Sender rules only authorize that
destination; a blocked account/client rule wins. REVIEW stores clean attachments
and holds unknown senders for a broker decision; ALLOWLIST holds unknown emails
before attachment download. OPEN still requires scanning and safe shipment matching.

Addresses normalize case, display-name wrappers and `+suffix`. Emails naming two
different destinations are rejected rather than choosing one. A single unambiguous
match above the configured threshold (default/minimum 0.75) can attach. Every other
case remains in Email review; there is no most-recent-shipment fallback.

Rotation issues a new address and accepts the old address for 30 days. Suspension
rejects immediately and can be resumed. Revocation is permanent. Expired rotation
grace is revoked by the existing inbound cron. These changes are audited. Address
issuance on setup synchronization does not resurrect a revoked destination.

The old `RESEND_ALLOWED_INBOUND_RECIPIENTS` list remains active only while the new
flag is off. The backfill deliberately does not assign a shared legacy address to
an arbitrary account: a common inbox may already serve multiple accounts. Rollout
requires distributing the new operations/client addresses. Legacy sender resolution
now quarantines ambiguity if the same sender has rules in multiple accounts.

## Broker and portal checks

- Forward a PDF with an exact shipment number to the matching client address. Verify
  scan-before-storage, source `INBOUND_EMAIL`, the correct account/client storage
  prefix, and a stored candidate with the matching identifier.
- Give two shipments the same container number: both candidates must be visible in
  Email review. No shipment is preselected. Preview, choose explicitly, and attach.
- Send from an unknown sender under REVIEW, then ALLOWLIST. The former stores a
  customer-visible review item; the latter stores no attachment until approval.
- Try another client's shipment ID, a foreign workspace ID, a suspended/revoked
  address, a duplicate signed webhook, and a malware-positive attachment. None may
  create a wrong attachment or expose a hidden document.
- After attachment to a shipment with a published proof, verify a fresh DRAFT with
  inbound evidence and a SYSTEM-generated event. The published proof stays intact.
- In Portal, inspect setup/onboarding addresses, emailed document status, the shipment
  document note, and the receipt notification. INTERNAL inbound and discarded
  documents must be absent from lists and return 404 from downloads.
- Repeat a worker tick and a completed review decision. No duplicate document or
  proof draft should appear. Interrupt after storage/parser completion and verify
  the cron resumes parse dispatch, matching and pending proof generation.

## Operations and rollback

The existing `/api/cron/inbound-email-processing` handles pending email leases,
rotation expiry, parser-completion recovery, and pending receipts. The document
parser worker must also be running. Inspect InboundEmail routing states,
InboundAttachment rejection reasons, InboundDocumentReview OPEN counts, and
ShipmentDocument `inboundProofPending` when diagnosing a stalled intake.

Turn off automatic replies first if needed. Turning off the address flag restores
legacy webhook recipient/sender routing and hides the new address cards; existing
client-address emails already accepted can finish processing safely. New emails to
those addresses will not be accepted until re-enabled. Keep the additive migration
and stored audit/document records; do not drop the new tables during rollback.

## Validation scope

Local verification covers routing/review service boundaries, sender and address
lifecycle, malware rejection, matching, Entry Proof draft/idempotency, and portal
read/download predicates. A live Resend delivery, live database migration, real
ClamAV/storage/parser run, and authenticated browser smoke checks require a configured
sandbox and must be completed before enabling production. The fixture demo below
uses the real worker and scanner/storage; its PDF text is supplied deterministically
for the matching step so the demo does not depend on an external OCR response.
