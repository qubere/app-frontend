# Client email ingestion — per-client inbound document addresses (build epic)

**Status:** Implemented and merged to `main` (issue #297; see `docs/operations/CLIENT-EMAIL-INGESTION-ROLLOUT.md` for the current rollout/config state and `docs/sales/CLIENT-EMAIL-INGESTION-DEMO.md` for the live walkthrough). `InboundAddress`, `InboundDocumentReview`, the reworked webhook/worker, broker review UI, and the client-scoped `auto-attach-process` fix all exist in code (`apps/custom/src/modules/inbound/*`, `packages/db/prisma/schema.prisma`). Feature-gated behind `INBOUND_CLIENT_ADDRESSES_ENABLED` / `INBOUND_AUTO_REPLY_ENABLED` (both default off) as described below.
**Owner area:** `apps/custom`, `apps/portal`, `packages/db`
**Closes:** #104 (client email ingestion), #260 (tenant-safe inbound document email — routing contract)
**Depends on:** #294 (`/setup` page + onboarding→portal — this epic adds the inbound address to that surface), `feat/document-intake-improvements` branch (weighted matcher — merge first)
**Related:** #158 (document intake), #229 (F02 Document Intelligence), #204 (intake improvements)

---

## 1. Why

Once a design partner is on Entry Proof (#294), the retention driver is **"forward us your documents and it just works."** Today the customer has to log into the portal and upload each file by hand. `#104`: *"anytime you add a client … enable them to send email to Qubere to accept docs."*

The inbound pipeline is **substantially built** — this epic is mostly **wiring + a routing-model change + surfacing**, not greenfield.

### What already exists (reuse)

| Piece | Location |
|---|---|
| Resend `email.received` webhook — signature-verified (svix), event-dedup, fast-ack + `after()` dispatch | `apps/custom/src/app/api/webhooks/resend/inbound/route.ts` |
| Durable worker: attachment fetch → ClamAV scan → storage → `ShipmentDocument` → extraction/classification | `apps/custom/src/modules/documents/processing/inboundEmailWorker.ts` |
| Cron backstop | `apps/custom/src/app/api/cron/inbound-email-processing/route.ts` |
| Models: `InboundEmail` (routingStatus RECEIVED→ROUTED→ACCEPTED/QUARANTINED/REJECTED), `InboundAttachment` (PENDING→STORED/QUARANTINED/REJECTED), `InboundSenderRoute` | `packages/db/prisma/schema.prisma` |
| **Sender**-based routing: `resolveInboundRoute(fromAddress)` → `InboundSenderRoute` (globally unique on `normalizedSenderEmail`) | `apps/custom/src/modules/inbound/senderRouting.ts` |
| Quarantine review (platform-admin release of unrecognized-sender mail) | `apps/custom/src/modules/inbound/quarantineReview.ts`, `QuarantineInboxTable.tsx`, `QuarantinedInboundPanel.tsx` |
| Settings UI: one public address + sender allowlist management | `apps/custom/src/app/app/admin/settings/DocumentEmailPanel.tsx`, `/api/settings/inbound-senders` |
| **Weighted multi-identifier shipment matcher** (`matchShipmentForDocument()`, `DocumentShipmentCandidate.scoreBreakdown`, `isMatchConflict()`), ranked attach picker, match-conflict lane, ClamAV, batch `/v1/intake` | branch `feat/document-intake-improvements` (7 commits, **unmerged**) |
| `DocumentShipmentCandidate` (kept even when not selected — "why didn't this match?") | schema |
| Portal document list + upload | `apps/portal/src/app/(portal)/documents/page.tsx`, `/api/documents` |

### The gaps

1. **Routing is by sender, not recipient.** `InboundSenderRoute.normalizedSenderEmail` is globally unique → one address (`docs@inbound.qubere.ai`) for everyone, routed by who sent it. Fragile (forwards, shared mailboxes, spoofing) and **cannot tell which client** within an account. #260's contract is the opposite: an **opaque per-destination address** `docs-<token>@inbound.qubere.ai`, token → one account + optionally one client; the recipient address is the router, the sender is a security check.
2. **Nothing is client-scoped.** `InboundEmail` / `InboundAttachment` carry `accountId` only. Emailed docs can't be attributed to a `Client` and so never become portal-visible.
3. **No per-client issuance.** No address is minted when a client is created / onboarding activates; nothing surfaces it to the customer.
4. **`auto-attach-process` fallback is wrong for multi-client** — it grabs `shipment.findFirst({ accountId, deletedAt: null }, orderBy: updatedAt desc)` (`apps/custom/src/app/api/documents/[id]/auto-attach-process/route.ts`). Must be client-scoped + confidence-gated.
5. **Matched docs don't feed Entry Proof.** A commercial invoice that lands by email and matches a filed entry should appear as an `EvidenceRef` on the relevant `EntryProofLine`.

---

## 2. Target architecture (the #260 contract, made real)

```
   partner emails / CCs  docs-a1b2c3d4e5@inbound.qubere.ai
              │
              ▼
   POST /api/webhooks/resend/inbound        (signature verify, dedup — unchanged)
     │  extract recipient token from data.to / data.received_for
     │  resolveInboundAddress(token) ─────────────▶ InboundAddress { accountId, clientId? , status }
     │  write InboundEmail { accountId, clientId, inboundAddressId, routingStatus }
     │  senderPolicy(accountId, clientId, fromAddress) → ALLOW | REVIEW | BLOCK
     └─ after() → runInboundEmailWorkerTick()
              │
              ▼
   inboundEmailWorker  (per attachment)
     ClamAV scan → store (folder scoped by client) → ShipmentDocument { accountId, clientId, source:"INBOUND_EMAIL", portalVisibility }
     → extraction + classification (Document Intelligence — unchanged)
     → matchShipmentForDocument()  (weighted, client-scoped candidate pool)
         ├─ single high-confidence match  → attach to shipment, DocumentShipmentCandidate(autoSelected)
         │                                  → if shipment has a filed entry: regenerate EntryProof DRAFT, add EvidenceRef
         ├─ conflict / low confidence      → InboundDocumentReview lane (broker), doc stays unattached but client-scoped + portal-visible
         └─ no candidates                  → same lane, reason "NO_MATCH"
     → Notification (broker: "3 documents from Acme") + portal event ("We received your commercial invoice")
     → optional auto-reply to sender (per-address setting)
```

**Key principle (unchanged from #294):** deterministic, explainable, never a silent guess. `DocumentShipmentCandidate` rows are always written so "why did/didn't this match?" is answerable. An unrecognized **sender** to a **valid address** is REVIEW (broker sees it, client-scoped), not silent drop — different from today's platform-admin quarantine for unknown *address*.

---

## 3. Schema changes (`packages/db/prisma/schema.prisma`)

Migration: `<timestamp>_client_inbound_addresses`.

```prisma
/// An opaque inbound email address that routes to exactly one account and,
/// optionally, one client workspace. The address itself is the routing key
/// (docs-<token>@inbound.qubere.ai); the sender is a separate security signal,
/// not the router. Replaces sender-only routing as the primary mechanism.
model InboundAddress {
  id        String  @id @default(cuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  clientId  String?                       // null = account-level catch-all (broker ops inbox)
  client    Client? @relation(fields: [clientId], references: [id], onDelete: Cascade)

  /// URL-safe opaque token, >= 12 chars, unguessable. The local part is
  /// `${localPrefix}-${token}` (localPrefix defaults to "docs").
  token       String  @unique
  localPrefix String  @default("docs")
  /// Full address, denormalized for display + exact-match lookups. Unique.
  address     String  @unique

  label       String?                     // "Acme Corp — documents"
  status      String  @default("ACTIVE")  // ACTIVE | SUSPENDED | REVOKED
  purpose     String  @default("CLIENT_DOCUMENTS") // CLIENT_DOCUMENTS | ACCOUNT_OPS | ONBOARDING

  /// Sender handling for mail to this address:
  ///  OPEN      – accept from anyone (default for client doc intake; still ClamAV-scanned)
  ///  ALLOWLIST – only addresses on InboundSenderRoute (ACTIVE) for this account/client
  ///  REVIEW    – accept, but every unknown sender lands in the review lane
  senderPolicy String @default("REVIEW")

  autoReplyEnabled Boolean @default(true)
  defaultAssignedToUserId String?
  defaultAssignedToUser   User?  @relation("InboundAddressAssignee", fields: [defaultAssignedToUserId], references: [id], onDelete: SetNull)

  createdByUserId String?
  revokedAt       DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  inboundEmails InboundEmail[]

  @@index([accountId])
  @@index([clientId])
  @@index([status])
}

/// Broker-facing lane for emailed documents that could not be safely
/// auto-placed: no shipment match, a match conflict, or an unknown sender to
/// a REVIEW-policy address. The document is already stored, client-scoped, and
/// (for known clients) portal-visible — this row is the "needs a decision"
/// pointer, resolved by attach / reassign / discard.
model InboundDocumentReview {
  id        String  @id @default(cuid())
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  clientId  String?
  client    Client? @relation(fields: [clientId], references: [id], onDelete: SetNull)

  inboundEmailId     String
  inboundEmail       InboundEmail     @relation(fields: [inboundEmailId], references: [id], onDelete: Cascade)
  shipmentDocumentId String?          @unique
  shipmentDocument   ShipmentDocument? @relation(fields: [shipmentDocumentId], references: [id], onDelete: SetNull)

  reason        String   // NO_MATCH | MATCH_CONFLICT | UNKNOWN_SENDER | LOW_CONFIDENCE | EXTRACTION_FAILED
  candidateSummary Json?  // top DocumentShipmentCandidate rows + scores, for the "why" UI
  status        String   @default("OPEN") // OPEN | RESOLVED | DISCARDED
  resolvedByUserId String?
  resolvedShipmentId String?
  resolvedAt    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([accountId, status])
  @@index([clientId, status])
}
```

**Column adds:**

```prisma
// InboundEmail — add:
clientId        String?
client          Client?         @relation(fields: [clientId], references: [id], onDelete: SetNull)
inboundAddressId String?
inboundAddress   InboundAddress? @relation(fields: [inboundAddressId], references: [id], onDelete: SetNull)
recipientAddress String?        // the normalized to-address that matched, for audit
// widen routingStatus comment: + NEEDS_REVIEW
// InboundEmail index add: @@index([clientId])

// InboundAttachment — add:
reviewId String?   // set when routed to InboundDocumentReview
// (shipmentDocumentId already exists)
```

Back-relations: `InboundAddress[]` + `InboundDocumentReview[]` on `Account`; `InboundAddress[]` + `InboundDocumentReview[]` + `InboundEmail[]` on `Client` (some already present — verify); `ShipmentDocument.inboundReview InboundDocumentReview?`.

**`InboundSenderRoute` is kept** — it becomes the ALLOWLIST / BLOCK layer, consulted per (account, client) instead of as the global router. Add optional `clientId String?` to scope an allow/block to one client; `normalizedSenderEmail` stays unique per row but the resolver keys on `(accountId, clientId?, normalizedSenderEmail)`.

---

## 4. Address issuance

### 4.1 Service — `apps/custom/src/modules/inbound/inboundAddressService.ts` (new)

```ts
issueClientInboundAddress({ accountId, clientId, label?, createdByUserId, purpose?, senderPolicy? }): Promise<InboundAddress>
//  token = base32(crypto.randomBytes(10))  -> ~16 chars, url-safe, unguessable  (NO Math.random)
//  address = `${localPrefix}-${token}@${INBOUND_EMAIL_DOMAIN}`   (env, default "inbound.qubere.ai")
//  idempotent: if an ACTIVE CLIENT_DOCUMENTS address exists for (accountId, clientId), return it
revokeInboundAddress(id, { revokedByUserId, reason })      // status REVOKED, mail after → REJECTED "address_revoked"
rotateInboundAddress(id, { rotatedByUserId })              // new token+address, old → SUSPENDED for 30d grace then REVOKED
resolveInboundAddress(rawRecipient): Promise<{ address: InboundAddress } | null>   // normalize, strip +suffix, exact match on `address`
```

Every mutation writes an `AuditLog` row (`entity: "InboundAddress"`).

### 4.2 Issuance triggers

| Trigger | Where | Action |
|---|---|---|
| Client created | `Client` create paths (broker `app/clients`, `seed-customer-portal.ts`, onboarding) | `issueClientInboundAddress({ purpose: "CLIENT_DOCUMENTS", senderPolicy: "REVIEW" })` |
| Onboarding case activated (`OnboardingCase.status → activated`) | `clientSetup.ts` (from #294 §14.4) | ensure address exists; include it in the `ACCOUNT_ACTIVATED` notification and the portal `/setup` payload |
| Broker clicks "Regenerate address" | new settings action | `rotateInboundAddress` |
| Account-level ops inbox | one-time per account (migration backfill + account create) | `issueClientInboundAddress({ clientId: null, purpose: "ACCOUNT_OPS" })` — preserves today's behaviour |

**Backfill migration script** `apps/custom/scripts/backfill-inbound-addresses.ts`: one `ACCOUNT_OPS` address per account (reusing the existing `RESEND_ALLOWED_INBOUND_RECIPIENTS` value where set), one `CLIENT_DOCUMENTS` address per existing `Client`. Existing `InboundSenderRoute` rows stay as ALLOWLIST entries on the account-ops address.

---

## 5. Webhook + worker changes

### 5.1 `webhooks/resend/inbound/route.ts`

- Replace `allowedRecipients()` flat-list check with: for each candidate in `[...data.to, ...data.received_for]`, `resolveInboundAddress(candidate)`. First match wins.
  - **match** → `InboundEmail { accountId, clientId, inboundAddressId, recipientAddress, routingStatus: "RECEIVED" }`, dispatch worker (unchanged `after()` + cron backstop).
  - **no match** → `routingStatus: "REJECTED"`, `quarantineReason: "recipient_not_recognised"` (today's behaviour for unknown address — keep the platform-admin quarantine path).
  - address `SUSPENDED`/`REVOKED` → `REJECTED` with the specific reason; if `autoReplyEnabled`, queue a bounce-style auto-reply ("this address is no longer active — contact your broker").
- Keep svix verification, event dedup (`@@unique([provider, providerEventId])`), fast 202.

### 5.2 `inboundEmailWorker.ts` — `processOneEmail`

- Email now arrives **already attributed** (`accountId`, `clientId`, `inboundAddressId`). Drop the "route by sender to find the account" step; instead:
  1. **Sender policy check** using `inboundAddress.senderPolicy`:
     - `OPEN` → proceed (ClamAV still runs).
     - `ALLOWLIST` → sender must be an ACTIVE `InboundSenderRoute` for `(accountId, clientId)`. Else `routingStatus: "NEEDS_REVIEW"`, create `InboundDocumentReview { reason: "UNKNOWN_SENDER" }` after storing attachments.
     - `REVIEW` (default) → proceed, but if sender unknown, still create the review row (doc is usable, broker just confirms provenance).
     - Blocked sender (`InboundSenderRoute.status = BLOCKED` for this scope) → `REJECTED`, `blocked_sender`, no storage.
  2. Store attachments in a **client-scoped folder** (`documents/<accountId>/<clientId>/…` via `@qubere/storage`), create `ShipmentDocument { accountId, clientId, source: "INBOUND_EMAIL", portalVisibility: <default> }`.
     - `portalVisibility` default: `CUSTOMER` when `clientId` set and the address `purpose = CLIENT_DOCUMENTS` (the client sent it — they can see it); `INTERNAL` for `ACCOUNT_OPS`.
  3. Extraction + classification — **unchanged** (Document Intelligence).
  4. **Match** — `matchShipmentForDocument()` with a candidate pool **filtered to `clientId`** (falls back to account scope only for `ACCOUNT_OPS`). Then:
     - `result.autoSelected && topScore >= AUTO_ATTACH_THRESHOLD` (config, default 0.75) → attach: `ShipmentDocument.shipmentId`, `DocumentShipmentCandidate(autoSelected: true)`, `InboundEmail.routingStatus: "ACCEPTED"`. **Entry Proof hook (§6).**
     - `isMatchConflict(result)` or `topScore < AUTO_ATTACH_THRESHOLD` → `InboundDocumentReview { reason: MATCH_CONFLICT | LOW_CONFIDENCE, candidateSummary }`, `routingStatus: "NEEDS_REVIEW"`.
     - no candidates → `InboundDocumentReview { reason: "NO_MATCH" }`.
  5. **Notify** — broker `Notification { type: "INBOUND_EMAIL_DOCUMENTS", message: "3 documents from Acme Corp — 2 attached, 1 needs review" }`; portal event per §7.
  6. **Auto-reply** (if `inboundAddress.autoReplyEnabled`): one email back to the sender summarising what was received and where it went ("Commercial Invoice attached to SHP-ACME-2026-002; Packing List needs our review"). Uses the existing Resend send client. Rate-limited: at most one auto-reply per `InboundEmail`.

---

## 6. Entry Proof integration (ties to #294)

When the worker auto-attaches a document to a shipment that has a `CustomsFiling` with a `PUBLISHED` `EntryProof`:

- Call `entryProofService.generate(filingId, systemCtx)` to produce a fresh **DRAFT** (never auto-publish — the broker still reviews).
- The generated payload's affected `EntryProofLine.evidence[]` picks up a new `EvidenceRef { kind: "DOCUMENT", label: "<fileName> (received by email <date>)", sourceModel: "ShipmentDocument", sourceId, portalHref }`.
- `EntryProofEvent { type: "GENERATED", detail: { trigger: "INBOUND_DOCUMENT", shipmentDocumentId } }`.
- Broker sees "Proof out of date — new document received" on the filing's Entry Proof tab.

This is what makes email ingestion visibly valuable: the customer emails an invoice, and their own Entry Proof gets a new evidence line.

---

## 7. Portal surface (`apps/portal`)

| File | Change |
|---|---|
| `src/app/(portal)/setup/page.tsx` (from #294) | Add a **"Send us documents"** card: the client's `InboundAddress.address` + copy button + one line ("CC this on anything — invoices, packing lists, BLs, arrival notices. It attaches to the right shipment automatically."). |
| `src/app/(portal)/onboarding/[token]/page.tsx` | On the "done" step, show the same address. |
| `src/app/(portal)/documents/page.tsx` | Show `source: "INBOUND_EMAIL"` docs with an "emailed" chip; group by shipment; show "processing / attached to SHP-… / with your broker". |
| `src/app/(portal)/shipments/[id]/page.tsx` | Documents tab already filters `portalVisibility = CUSTOMER` — emailed docs now appear automatically. Add a small "received by email <date>" note. |
| `src/app/(portal)/page.tsx` | Dashboard: "We received 2 documents for SHP-ACME-2026-002" in the activity area. |
| `src/app/api/setup/route.ts` (from #294) | Add `inboundAddress: { address, purpose } | null` to `SetupSummary`. |

**Portal API (new):** `GET /api/inbound-address` — client-scoped, perm `portal.setup.read` — returns the client's ACTIVE `CLIENT_DOCUMENTS` address (or 404). Used if the card is rendered outside `/setup`.

**No portal write path** — the customer never manages the address; the broker rotates/revokes it. Keeps issuance broker-controlled (same stance as #294's invite flow).

---

## 8. Broker surface (`apps/custom`)

| File | Change |
|---|---|
| `src/app/app/admin/settings/DocumentEmailPanel.tsx` | Rework: show the **account-ops address** + a per-client table (client, address, status, sender policy, last received). Actions: copy, regenerate (`rotate`), suspend/revoke, set sender policy, toggle auto-reply. |
| `src/app/app/clients/[id]` (the "Portal & setup" panel from #294 §14.6) | Show this client's inbound address + last-received timestamp + a link to its review lane. |
| **New:** `src/app/app/documents/InboundReviewTable.tsx` + `/api/broker/inbound-reviews` (+ `[id]/resolve`, `[id]/discard`) | The `InboundDocumentReview` lane: doc preview, sender, `candidateSummary` ("matched CONTAINER ABCU1234567 on 2 shipments"), actions: attach to shipment X / reassign client / discard. Resolving attaches the doc and (if applicable) fires the Entry Proof hook. |
| `src/app/api/settings/inbound-senders/*` | Extend to accept an optional `clientId` scope; keep account-wide as the default. |
| `src/app/api/documents/[id]/auto-attach-process/route.ts` | **Fix**: candidate pool must be `clientId`-scoped; remove the "most recent shipment" fallback — no confident match → `InboundDocumentReview`, not a guess. |

Config (env, documented in `.env.example`): `INBOUND_EMAIL_DOMAIN=inbound.qubere.ai`, `INBOUND_AUTO_ATTACH_THRESHOLD=0.75`, `INBOUND_ADDRESS_TOKEN_BYTES=10`.

---

## 9. Merge `feat/document-intake-improvements` first

That branch (7 commits) carries the weighted matcher, `scoreBreakdown`, ranked attach picker, match-conflict detection (`isMatchConflict`), tracking-identifier materialisation, batch `/v1/intake/document`, and ClamAV. This epic **depends on all of it**. Task 0: rebase onto `main`, resolve, open the PR, land it. Do not re-implement matching in this epic.

---

## 10. Seed & demo

Extend the partner-portal demo seed (`apps/custom/scripts/seed-partner-portal-demo.ts` from #294):

- Issue a `CLIENT_DOCUMENTS` `InboundAddress` for **Target Corporation** and **Amazon Import Services** (deterministic token in seed — e.g. `docs-tgtdemo0001@inbound.qubere.ai`, `docs-acmedemo002@…` — so the demo address is stable).
- Add `InboundSenderRoute` ALLOWLIST entries: `porter@target.com` → Target address; `trade@amazon-import.test` → Amazon address.
- Simulate **three inbound emails** via a new `apps/custom/scripts/seed-inbound-email-demo.ts` that calls the worker with fixture attachments (reuse `apps/custom/scripts/seed-inbound-demo.ts` patterns + `assertDemoSeedingAllowed()`):
  1. From `porter@target.com` → Target address, subject `"Commercial Invoice — SHP-TGT-2026-001"`, attachment `commercial-invoice.pdf` → **auto-attaches** to `SHP-TGT-2026-001`, regenerates its `EntryProof` DRAFT with a new evidence line.
  2. From `trade@amazon-import.test` → Amazon address, subject `"Docs for container CBHU8842190"`, attachment `packing-list.pdf` → container matches **two** Amazon shipments → **`InboundDocumentReview { reason: MATCH_CONFLICT }`**.
  3. From an **unknown** sender `logistics@freightco.example` → Amazon address (policy REVIEW), attachment `arrival-notice.pdf` → stored, client-scoped, portal-visible, `InboundDocumentReview { reason: UNKNOWN_SENDER }`.
- Fixture PDFs: 2–3 tiny generated PDFs under `apps/custom/scripts/fixtures/inbound/` (or reuse existing test fixtures).

```bash
npm --workspace @qubere/db run db:seed
npx tsx apps/custom/scripts/seed-partner-portal-demo.ts
npx tsx apps/custom/scripts/seed-inbound-email-demo.ts        # localhost + demo (DATABASE_URL=$DEMO)
```

Demo script `docs/sales/CLIENT-EMAIL-INGESTION-DEMO.md`: "Portal (Target) → /setup → copy the address → send yourself a test invoice → refresh the shipment: document attached, Entry Proof shows a new evidence line. Then show the broker review lane with the Amazon conflict."

---

## 11. Test plan

**Unit:**
- `inboundAddressService`: token unguessability (length/charset), idempotent issuance, rotate keeps grace window, `resolveInboundAddress` strips `+suffix` and is case-insensitive.
- `senderPolicy` evaluation: OPEN / ALLOWLIST / REVIEW / BLOCKED × known/unknown sender → correct routing outcome.

**Route (`apps/custom`, vitest):**
- Webhook: valid token → `InboundEmail` attributed to (account, client); unknown token → REJECTED; revoked address → REJECTED + auto-reply queued; duplicate `svix-id` → idempotent 200.
- Worker: auto-attach above threshold; conflict → `InboundDocumentReview`; no-match → review; unknown sender to ALLOWLIST address → review; ClamAV positive → REJECTED, no `ShipmentDocument`.
- **Cross-tenant:** an email to Target's address can never attach to an Amazon shipment (candidate pool scoping test).
- Entry Proof hook: auto-attach to a shipment with a published proof → new DRAFT with an added `EvidenceRef`, not auto-published.

**Portal (vitest):**
- `GET /api/inbound-address` returns only the caller's client address; 404 for a client with none.
- Emailed `CUSTOMER`-visible doc appears in `/api/shipments/[id]` documents; `INTERNAL` one does not.

**E2E (if wired):** send fixture email → worker tick → doc visible in portal + broker review lane populated.

---

## 12. Rollout / safety

- `INBOUND_EMAIL_DOMAIN` must have Resend inbound MX + the webhook endpoint registered before enabling. Until then, `resolveInboundAddress` still works; no mail arrives.
- Feature flag `INBOUND_CLIENT_ADDRESSES_ENABLED` (default off in prod): when off, webhook falls back to today's `RESEND_ALLOWED_INBOUND_RECIPIENTS` + sender routing. Flip on per environment after the backfill script runs.
- Auto-reply is opt-out per address and globally gated by `INBOUND_AUTO_REPLY_ENABLED` — off until a human has watched it send once (don't email customers from a cron on day one).
- All attachments ClamAV-scanned before storage (already true on the merge branch); inline attachments (signature logos) skipped as today.

---

## 13. Task breakdown for Codex

- [ ] **0** Rebase + merge `feat/document-intake-improvements` to `main` (weighted matcher, conflict detection, ClamAV, batch intake)
- [ ] **1** Schema: `InboundAddress`, `InboundDocumentReview`, column adds on `InboundEmail` / `InboundAttachment` / `InboundSenderRoute`; migration; `prisma generate`
- [ ] **2** `inboundAddressService.ts` (issue / revoke / rotate / resolve) + unit tests + `AuditLog` wiring
- [ ] **3** Issuance triggers: `Client` create paths + `clientSetup.ts` activation hook + `backfill-inbound-addresses.ts`
- [ ] **4** Webhook: recipient-token resolution, attributed `InboundEmail`, revoked/suspended handling + auto-reply queue
- [ ] **5** Worker: drop sender-routing-for-account, add `senderPolicy` gate, client-scoped storage + `ShipmentDocument` (`source`, `portalVisibility`), client-scoped match pool, `InboundDocumentReview` creation, notifications
- [ ] **6** Entry Proof hook: auto-attach → `entryProofService.generate` DRAFT + `EvidenceRef` + `EntryProofEvent`
- [ ] **7** Fix `auto-attach-process` route (client-scoped pool, no blind fallback)
- [ ] **8** Broker UI: reworked `DocumentEmailPanel` (per-client table), `InboundReviewTable` + `/api/broker/inbound-reviews` (+ resolve/discard), `app/clients/[id]` address card
- [ ] **9** Portal UI: `/setup` "Send us documents" card, onboarding done-step, `/documents` emailed chip, `SetupSummary.inboundAddress`, `GET /api/inbound-address`
- [ ] **10** Seed: addresses + allowlist on Target/Amazon, `seed-inbound-email-demo.ts` (3 fixture emails), fixture PDFs
- [ ] **11** Config + feature flags + `.env.example` + rollout doc + `docs/sales/CLIENT-EMAIL-INGESTION-DEMO.md`
- [ ] **12** Tests per §11

## 14. Out of scope (v1)

- Reply-threading / two-way email conversations on a shipment (the auto-reply is one-shot, not a thread). Full email threads = later, could fold into `CustomerRequest`.
- Parsing the email **body** for instructions ("please expedite") — v1 handles attachments only; body is stored on `InboundEmail.subject`/raw for context.
- Per-sender trust learning / auto-promoting a REVIEW sender to the allowlist after N clean emails — nice follow-up, not v1.
- Non-PDF/image attachment handling beyond what the current pipeline supports.
- Outbound "request documents by email" (that's the existing `CustomerRequest` flow; this epic is inbound only).
