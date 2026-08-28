# Customer Portal (PR #97) — Review & Fix Plan

**Reviewed:** 2026-08-28 · **Branch:** `feature/customer-portal` · **Base:** `main`

> **Status (2026-08-28, follow-up commits on this branch):**
> DONE — P0-1 (migration), P0-2 (proxy auth), P0-3/P0-5/P0-6 (`resolvePortalClientScope`
> on all list routes + services), P0-4 (scope-engine), P0-7 (passwordless provisioning
> + seed env var + sign-in page), P0-8 (permission enforcement), P1-1 (invite acceptance
> flow), P1-2 (attach-doc authz + projection), P1-3 (request projection), P1-4
> (inbound-email demo gate), **P1-5 (object storage — new `@qubere/storage` package;
> GCS in prod, local-fs only for localhost; no bytes in Postgres; upload→store→pointer
> →download→delete verified end to end)**, P1-7/P1-8 (upload validation), P1-9
> (demo-auth single flag), P2-2 (untrack uploads).
> STILL OPEN — P1-6 (real 7501/invoice PDFs — no PDF lib in repo; downloads still
> return stubs), P2-1 (real two-tenant route tests), P2-3..P2-10, P3.
**Scope:** `apps/portal/**`, `packages/auth/**`, portal-touching routes in `apps/custom/**`, schema, Dockerfile, GCP deploy.
**Deployment target:** Docker on GCP Cloud Run, `NEXT_PUBLIC_APP_ENV=demo`, `--allow-unauthenticated`.

Verdict: **Strong product surface, not shippable as-is.** The portal shell, BFF, status
mapping, and broker-side request flow are real and coherent. But the multi-tenant
isolation model — the entire security premise of a customer portal — is not actually
enforced on the read paths, one change makes every stored trade document publicly
downloadable, an auto-provisioning path ships a hardcoded password, and there is no
database migration so the feature cannot deploy at all.

Overall completeness against the original gap note (`Customer portal 10%`): **~55%**.
Portal exists, is authenticated (Clerk), has client-scoped models and a broker "ask
the customer" workflow. Client-scoping is coded but bypassable; onboarding, real
documents, and tests are stubs.

---

## P0 — Blockers (must fix before merge)

### P0-1 · No Prisma migration for any portal schema change
`packages/db/prisma/schema.prisma` adds `CustomerRequest`, `CustomerRequestMessage`,
`CustomerRequestDocument`, and new columns (`ShipmentDocument.clientId`,
`ShipmentDocument.portalVisibility`, `ShipmentDocument.tmsOrderId/tmsLoadId`,
`CustomsFiling.customerVisibleAt` + `customerPublishedByUserId`, `Invitation.clientId`
+ `purpose` + `productScopes`). **No `packages/db/prisma/migrations/*` directory was
added.** The `database` Docker stage runs `prisma migrate deploy`; against a real DB
the portal throws `P2021 / column does not exist` on every query. Works locally only
because dev uses `db push`.
**Fix:** generate `prisma migrate dev --name add_customer_portal` and commit the SQL.
A hand-written migration is included in this PR's fix commits as a starting point —
regenerate against a shadow DB to confirm.

### P0-2 · `GET /api/documents/proxy` is now fully unauthenticated (regression)
`apps/custom/src/app/api/documents/proxy/route.ts` on `main` was
`withAuthenticatedRoute(...)` with `where: { id, accountId: ctx.accountId }`. This PR
**removed the auth wrapper and the accountId filter**, and `middleware.ts` adds
`isPublicRoute = /api/documents/proxy(.*)` to exempt it from Clerk. Result: anyone on
the internet can `GET /api/documents/proxy?documentId=<cuid>` and stream any tenant's
commercial invoices, packing lists, etc. IDs are cuids but appear in other API
responses and emails.
**Fix:** restore authentication. If the portal (separate origin) needs previews, add a
portal-authenticated proxy in `apps/portal` that runs `authorizePortalResource` on the
document, or issue short-lived signed URLs. Do **not** leave a public byte endpoint.

### P0-3 · `clientId` query param is trusted everywhere — cross-tenant read IDOR
None of the portal list endpoints validate that a caller-supplied `?clientId=` is in
the user's `authorizedClientIds`:
- `apps/portal/src/app/api/shipments/route.ts` — `if (clientId) whereClause.clientId = clientId`
- `apps/portal/src/app/api/documents/route.ts` — `clientId ? { clientId } : ...`
- `apps/portal/src/app/api/requests/route.ts` — same
- `apps/portal/src/app/api/dashboard/route.ts` — `if (clientId) actionWhere.clientId = clientId`
- `apps/portal/src/app/api/invoices/route.ts` + `packages/db/.../portal-invoice-service.ts`
- `apps/portal/src/app/api/entries/route.ts` + `packages/db/.../portal-entry-service.ts`

Any authenticated portal user calls `?clientId=<other importer's client id>` and reads
that importer's shipments, documents, invoices, entry summaries, and broker
conversations. This defeats the whole portal.
**Fix:** central guard — if `clientId` is provided and `!scope.isAllClients &&
!scope.authorizedClientIds.includes(clientId)` → 403 (or ignore param and always
filter to the intersection). Apply to all six routes + both db services.

### P0-4 · `CUSTOMER_USER` / `CUSTOMER_ADMIN` / `PORTER` are treated as "all clients"
`packages/auth/src/scope-engine.ts` `getEffectiveUserScope()` lists `CUSTOMER_USER`,
`CUSTOMER_ADMIN`, `PORTER` in `isAllClientsRole`. `CUSTOMER_USER` is the **default**
portal role (see `broker/portal-invitations`, `seed-porter-user.ts`). So the default
customer sees `isAllClients: true` and `authorizedClientIds = every client in the
broker account`, regardless of their `UserClientAssignment`. The seeded demo user
`porter@target.com` — explicitly assigned only to "Target Corporation" — can read
"Amazon Import Services" data. The isolation the portal advertises does not exist.
**Fix:** remove `CUSTOMER_USER`, `CUSTOMER_ADMIN`, `PORTER` from `isAllClientsRole`.
Customer roles must resolve scope **only** from `UserClientAssignment` /
`TeamClientAssignment`. Decide explicitly what `CUSTOMER_ADMIN` means — almost
certainly "all users/clients belonging to *my* importer org", not the broker's whole
book. If a customer org maps to one `Client`, `CUSTOMER_ADMIN` is still single-client.

### P0-5 · List endpoints fail **open** when a user has zero client assignments
With `authorizedClientIds = []` (a customer whose assignment wasn't set up, which is
the norm today because there is no working invite-acceptance flow):
- `shipments/route.ts` → falls to `whereClause.accountId = ctx.accountId` → **all** shipments
- `documents/route.ts` → `authorizedClientIds.length === 0 ? {}` → **all** customer-visible docs
- `requests/route.ts` → same `{}` → **all** requests
- `invoices` / `entries` services → no `clientId` → **all** invoices / entries

`portal-auth.ts` is described as "fail-closed", but the list routes don't call it.
**Fix:** empty scope + not `isAllClients` ⇒ return empty set, never the account-wide set.

### P0-6 · `/api/shipments` OR-clause leaks the whole account
Even with a correct scope, `shipments/route.ts` builds
`whereClause.OR = [{ clientId: { in: authorizedClientIds } }, { accountId: ctx.accountId }]`.
The second term returns every shipment in the broker account.
**Fix:** drop the `{ accountId }` OR branch for scoped users; keep only the
`clientId in [...]` filter (plus `accountId` as an AND, not an OR).

### P0-7 · Hardcoded portal password in an auto-provisioning path
`apps/custom/src/app/api/shipments/[id]/documents/request/route.ts` auto-creates a
Clerk user for `recipientEmail` with `password: "QuberePass2026!"` (same string is in
`apps/portal/scripts/seed-porter-user.ts` and committed to git). A broker "request a
document" action silently provisions a real, login-capable portal account for an
unverified email address with a publicly-known password → account takeover of any
importer whose contact email is guessable.
**Fix:** never set a password. Provision as invitation-only: create the `Invitation`
row, email a tokenised accept link, let Clerk own credential creation on accept. Move
the seed password to an env var and out of git history.

### P0-8 · `authorizePortalResource(permission)` never checks the permission
`packages/auth/src/portal-auth.ts` takes `options.permission` and **never references
it**. Every resource route passes a permission string (`portal.requests.respond`,
`portal.entries.download`, `portal.documents.create`, …) that is silently ignored. A
`CUSTOMER_VIEWER` (read-only by design, per `portal-permissions.test.ts`) can POST
messages, upload and delete documents, and download entry PDFs. RBAC is decorative.
**Fix:** in `authorizePortalResource`, after loading `ctx`, verify
`ctx.permissions.includes(options.permission)` (with the porter/owner/admin
short-circuit already in `hasPorterAccess`) and 403 otherwise.

---

## P1 — High (fix before customers touch it)

### P1-1 · No invitation acceptance flow
`apps/portal/src/app/(auth)/invite/[token]/page.tsx` `handleAccept` is
`setTimeout(1200)` then `router.push("/")`. There is no route that reads the
`Invitation`, provisions the Clerk user, creates the `AccountMembership` + role +
`UserClientAssignment`, and marks the invite consumed. `broker/portal-invitations`
creates `Invitation` rows that nothing consumes. The only real user is the seed
script. Onboarding — a core requirement from the original gap note — is absent.
**Fix:** build `POST /api/invitations/[token]/accept` (+ a GET to render invite
details): validate token + expiry, bind to the authenticated Clerk identity, create
membership/role/assignment in a transaction, set `Invitation.acceptedAt`, audit.

### P1-2 · `requests/[id]/documents` attaches any document by id, returns raw row
`apps/portal/src/app/api/requests/[id]/documents/route.ts` (JSON and multipart
`existingDocId` branches): `db.shipmentDocument.findUnique({ where: { id }})` with **no
account/client check**, links it to the caller's request, and returns the full
document object (`...existingDoc`) — including `rawContent` (full base64 file bytes),
`fileUrl`, and internal columns. Cross-tenant document disclosure: pass any
`documentId`, get its contents in the JSON response.
**Fix:** load with `select` of safe fields only; run `authorizePortalResource` on the
document's `accountId`/`clientId`/`portalVisibility` before linking; return a
projected DTO.

### P1-3 · `requests/[id]` GET leaks the raw `CustomerRequest` row
`apps/portal/src/app/api/requests/[id]/route.ts` returns `{ ...request, actionId }` —
every column including `assignedUserId`, `createdByUserId`, `closedByUserId`,
`filingId`, internal `domain`, etc. Contrast the shipment detail route, which projects
carefully.
**Fix:** explicit DTO projection, matching the fields the UI actually renders.

### P1-4 · `inbound-email` route is an unauthenticated-shaped ingestion primitive
`apps/portal/src/app/api/documents/inbound-email/route.ts`: authenticated but no
permission check, `senderEmail` is caller-controlled, it auto-creates
`InboundSenderRoute` records and ingests arbitrary files as `CUSTOMER`-visible docs
against `scope.authorizedClientIds[0]`. If this is meant to be an email-provider
webhook it needs signature verification and must not be in the portal's authed
surface; if it's a demo helper it should be gated out of production builds.
**Fix:** decide what it is. Webhook → move to `apps/custom`, verify provider
signature, no session. Demo tool → `if (process.env.NEXT_PUBLIC_APP_ENV !== "demo")
return 404`.

### P1-5 · Uploads go to local disk + base64-in-Postgres; no object storage — FIXED
~~`requests/[id]/documents` writes files to `process.cwd()/uploads/quarantine/...` and
stores the whole file base64 in `ShipmentDocument.rawContent`.~~
**Done:** new `packages/storage` (`@qubere/storage`) is the single object-storage core
for all apps + the `@qubere/db` upload service — GCS (`qubere-demo-uploaded-documents`,
`documents/` and `quarantine/` prefixes) in prod, Vercel Blob where configured, local
disk under `.qubere/storage/uploads` **only** on localhost (throws on a serverless
host). `processSharedDocumentUpload` and the portal request-upload route now write
bytes to storage and persist only a `fileUrl` pointer + checksum + byteSize — never
`rawContent`. `apps/custom/src/lib/storage.ts` re-exports the shared core and keeps
just its File/MIME/malware wrapper. Portal download reads via `readStoredObject`;
delete removes the object (`deleteStoredObject`). Verified end to end on localhost:
upload → `/uploads/...` pointer, `rawContent: null` → download 200 `%PDF` → delete →
download 404, file gone.

### P1-6 · `entries/[id]/download` and `invoices/[id]/download` return fake PDFs
Both return a hand-built `%PDF-1.4 ... mock` string, not a rendered document.
`documents/[id]/download` fabricates a "VERIFIED CUSTOMS VAULT RECORD" HTML page when
`rawContent` is empty. "Self-serve document download" from the gap note isn't real,
and fabricated official-looking output is exactly the anti-pattern flagged in prior
reviews.
**Fix:** generate real 7501 / invoice PDFs (server-side render) or serve the actual
stored artifact; if neither exists yet, return `501 Not Implemented` rather than a
convincing fake.

### P1-7 · No upload validation (size, type, count)
`documents/route.ts` POST and `requests/[id]/documents` accept any `File` with no size
cap, MIME allowlist, or rate limit, then buffer it fully in memory and base64 it.
Trivial memory-exhaustion / storage-abuse vector on a public service.
**Fix:** enforce max size (e.g. 25 MB), extension/MIME allowlist (pdf/jpg/png/tiff/
docx/xlsx), and per-user rate limiting at the edge.

### P1-8 · Path-traversal in the quarantine writer
`requests/[id]/documents` does `path.join(dir, fileName)` with `fileName = file.name`
straight from the multipart body. `fileName` containing `../` escapes the quarantine
dir. (The `loadDocumentBytes` reader is guarded; the writer here is not.)
**Fix:** `path.basename(fileName)` and reject `.`/`..`/empty, same as `loadDocumentBytes`.

### P1-9 · Demo auth fallback is one env var away from "everyone is logged in"
`packages/auth/src/auth.ts`: when `NEXT_PUBLIC_APP_ENV === "demo"` (set by
`deploy-portal.sh`) **or** `NODE_ENV === "development"`, an unauthenticated request
returns `getDemoAccountContext()` = "first user in the DB", and the `catch` block does
the same on **any** error. Today the container sets `NODE_ENV=production`, and
`getDevOrDemoAccountContext` bails on `production`, so it's inert — but the safety
depends entirely on `NODE_ENV` never drifting, across both the portal *and* the
`custom` app (same change). One misconfigured revision = full auth bypass on a
`--allow-unauthenticated` service.
**Fix:** gate the demo fallback on a single explicit, non-public flag (e.g.
`QUBERE_ALLOW_DEMO_AUTH=1`) that is never set in the GCP deploy, and never fall back
to demo context from the `catch` path.

---

## P2 — Medium

- **P2-1 · Fake tests.** `apps/portal/tests/multi-tenant-customer-isolation.test.ts`
  mocks `authorizePortalResource` to return `{authorized:false}` then asserts it
  returned false — tautology. `apps/portal/e2e/customer-portal.spec.ts` is `vitest`
  (not Playwright) asserting string literals. `portal-auth.test.ts` is the only real
  one. These give false confidence. Replace with tests that exercise the actual route
  handlers against a seeded DB with two clients, asserting client B gets 403/empty for
  client A's ids and the `?clientId=` spoof is rejected.
- **P2-2 · Committed customer documents.** 11 PDFs under `apps/portal/uploads/
  quarantine/**` and `apps/custom/uploads/quarantine/**` are tracked. Add
  `apps/*/uploads/` to `.gitignore` and `git rm --cached` them.
- **P2-3 · `getEffectiveUserScope` shipment-contact branch is dead code.**
  `where: { accountId, ownerName: userId }` compares a display-name column to a user
  id — always empty. Either wire real shipment-level assignment or delete the branch.
- **P2-4 · `authorizePortalResource` importerName fuzzy match.** Falls back to
  `db.client.findFirst({ name: { contains: importerName, mode: "insensitive" }})` to
  resolve a missing `clientId`. Substring matching across tenants is fragile and can
  cross-link clients ("Target" ⊂ "Target Logistics"). Prefer requiring a real
  `clientId` on the resource; backfill nulls in a migration.
- **P2-5 · `CustomerRequestMessage.clientId` has no FK.** It's a bare `String` +
  index while every sibling column is a real relation. Add the `Client` relation for
  referential integrity and cascade behaviour.
- **P2-6 · Loose string columns.** `CustomerRequest.filingId`, `tmsOrderId`,
  `tmsLoadId` and `ShipmentDocument.tmsOrderId/tmsLoadId` are unindexed strings with
  no FK. Fine as forward-compat placeholders, but document that and index the ones
  queried.
- **P2-7 · In-process caches won't behave on Cloud Run.** `me/route.ts` (`meCache`),
  `documents/route.ts` (`cachedDocuments` — a single-entry cache keyed by
  `accountId:clientId:...` shared across *all* users of an instance),
  `dashboard/route.ts` (`inFlightDashboardPromises`), and the module-level caches in
  `scope-engine.ts` / `auth.ts` are per-instance and evaporate on scale-to-zero. The
  `documents` single-slot cache can also serve user A's page to user B if keys
  collide on `clientId=""`. Use request-scoped `cache()` or a shared store (the
  30s/5min staleness on permission data is also a privilege-revocation lag).
- **P2-8 · `documents/[id]/download` content sniffing + `inline`.** Serves
  user-uploaded bytes with a sniffed `Content-Type` and `Content-Disposition:
  inline`, and its HTML fallback is served `text/html`. The `custom` app's
  `documents/proxy` rewrite does this correctly (nosniff, CSP, attachment for
  unknown types) — port that same `serve()` logic here.
- **P2-9 · `deploy-portal.sh`** pins `--set-env-vars` to `NEXT_PUBLIC_APP_ENV=demo`
  and `GCP_PROJECT_ID` defaults to `qubere-prod`. Demo semantics on a prod project
  under a customer-facing hostname. Separate demo vs prod configs.
- **P2-10 · `apps/custom` `documents/[id]/attach` and `shipments/[id]/documents/
  request`** now call Clerk `createClerkClient` and DB writes inline in the request
  path with `catch {}` swallowing failures — partial provisioning leaves orphaned
  memberships. Move to a queued/Inngest step with proper error surfacing.

---

## P3 — Polish / product

- Portal `(portal)/layout.tsx` is 100% client-side, `capabilities` default to
  all-`true` before `/api/me` resolves (brief over-exposed UI), and it's littered
  with hardcoded fallbacks (`"Target Corporation"`, `"porter@target.com"`, literal
  account ids). Server-render the shell with the real context; drop the fallbacks.
- The client `<select>` switcher sets local state only; confirm every page re-fetches
  with the new `clientId` (and that the server enforces it — see P0-3).
- "Ask Qubere" / Help / Notifications are `alert()` / static `4` badge. Either wire or
  hide for v1.
- No empty/error/loading states audit done here — worth one before launch.
- Middleware `matcher` doesn't protect `/` or `/settings/*`; today they're client
  shells that 401 on data, but protecting them in middleware is cleaner.
- Accessibility, dark mode, mobile: not reviewed.

---

## Suggested sequencing

1. **Unblock deploy:** P0-1 (migration), P0-2 (proxy auth).
2. **Close isolation:** P0-3, P0-4, P0-5, P0-6, P0-8 — land together with real
   two-tenant route tests (P2-1).
3. **Close onboarding:** P0-7, P1-1.
4. **Storage + docs real:** P1-5, P1-6, P1-7, P1-8.
5. **Harden:** P1-4, P1-9, P2-7, P2-8.
6. **Cleanup:** P2-2, P2-3, P2-5, P3.

## Fixes included in this PR's follow-up commits

The review commits address the unambiguous, low-risk items directly; everything else
is left for implementation-with-tests per the sequencing above. See the commit
messages on `feature/customer-portal` after this doc.
