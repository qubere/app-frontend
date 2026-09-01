# Security, Trust & Platform — sales demo guide

**One-liner:** Qubere is built as multi-tenant enterprise infrastructure from the
ground up — account-based tenancy as the isolation boundary, separated platform
and customer RBAC, Clerk-managed identity with MFA, SOC2-ready immutable audit
logging on every mutating action, a governed data pipeline that refuses to
fabricate a number when its source isn't wired, and a scoped partner API.

**Who to sell it to:** **enterprise IT, security, and procurement** — the people
who kill deals in the security review. This doc is your answer to the
questionnaire and the "how is our data isolated" question. Also the **technical
buyer** in the room on any deal.

---

## The problem, in the customer's words

- "Every trade-compliance tool we've evaluated is a single-tenant app someone
  bolted a login onto. Where's the isolation boundary?"
- "Who at the vendor can see our data? Can their support team just look?"
- "We need an immutable audit trail for SOC2 and for CBP recordkeeping. Most
  tools have an activity feed, not an audit log."
- "Half these 'AI trade platforms' are making up duty rates and sanctions data.
  How do we know your numbers are real?"
- "We need API access, scoped, keyed, and logged — not a screen-scrape."

---

## Feature → what the customer gets → how to show it

### Tenancy & identity

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Account-based tenancy boundary** | The `Account` table is the source of truth for isolation. An `ENTERPRISE` account is a customer environment, created only by Qubere admins via the Platform Admin Console. Every business query filters by `accountId` (and `clientId` where relevant) through one shared data layer — not per-route ad hoc. | Platform Admin Console → the account list. Explain: every row of business data carries an account id and the data layer enforces it. |
| **Multi-account membership + switcher** | A user can belong to multiple accounts and switch active context; the tenant context is server-set, never trusted from the client. | Log in as `multirole@qubere.ai` → the account switcher → switch context → data changes. |
| **Auth vs. authorization split** | Authentication (identity, MFA, sessions, email/password verification) is Clerk. Authorization lives in PostgreSQL (`User`, `AccountMembership`, `Role`, `Permission`). Clean separation. | `/app/admin/roles` → the permission matrix. |
| **Separated platform & customer RBAC** | Platform roles (`PLATFORM_ADMIN`, `CUSTOMER_SUPPORT`, `BILLING_ADMIN`, `SECURITY_ADMIN`) for Qubere internal ops are a *different* system from customer account roles (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER` + custom roles). A support engineer's access is explicit and role-bound. | Explain the two-tier model; show custom role creation in `/app/admin/roles`. |
| **Impersonation is explicit and banner'd** | When a platform admin impersonates, there's a visible banner and it's audit-logged as impersonation. No silent "log in as customer." | Show the impersonation banner (platform admin feature). |
| **Row-level security** | Within an account, a PLANNER sees only their assigned records; an ADMIN sees all. Enforced in the query layer — and the AI assistant inherits it because it's the same code path. | Log in as `sarah@target.com` (PLANNER) vs `admin@target.com` — same page, different rows. |
| **Capability gating on API routes** | Every API route enforces capabilities via `hasPermission()` (`documents.create`, `filings.submit`, `intel.read`, …), returning `403` if the caller lacks it. Route guards (`withAuthenticatedRoute`) are applied consistently. | Attempt a gated action as a VIEWER → 403. |
| **Secure token invitations** | Invitations use secure unique tokens with `PENDING / ACCEPTED / EXPIRED / REVOKED` states, optionally scoped to a client and product scopes. | `/app/admin/users` → invite a user → the `/invite/<token>` flow. |

### Audit & governance

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **SOC2-ready immutable audit log** | Every administrative and mutating action writes an `AuditLog` entry: `accountId`, `userId`, `action`, `entity`, `entityId`, `metadata`, `ipAddress`, `userAgent`, `requestId`, and success/failure outcome. Best-effort write path — a logging failure never blocks or rolls back the action it records — shared by every module against a ~104-entry action catalogue. | `/app/admin/settings` → the settings audit panel. Every compliance module's audit history tab. |
| **Compliance notification outbox** | Compliance events queue durable notifications through an outbox/dispatcher (never sent inline), so a mail outage can't lose a hit notification. | `docs/compliance-notifications-and-audit.md`; show the notification history. |
| **CBP recordkeeping alignment** | The audit log is explicitly designed against CBP 19 U.S.C. § 1509 recordkeeping requirements, and per-filing audit packages assemble the evidence bundle. | Cross-link to [document-management.md](document-management.md). |

### Data pipeline governance

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Zero-Fabrication Policy** | 19 core platform datasets, each with an explicit status. Un-wired datasets return HTTP 422 and never fake success. Operational calculations derive strictly from verified government/multilateral sources. | Platform Admin → datasets registry. Walk the `LIVE` vs `NOT_YET_IMPLEMENTED` matrix — *this transparency is the trust argument*. |
| **Human-in-the-loop for legally-binding data** | A new HTS revision is staged as `DRAFT` and never auto-published — duty rates feed real filings, so a change goes through an explicit review-and-publish step. Same for Section 301, AD/CVD when they land. | Platform Admin → HTS releases → the DRAFT staging + publish action. |
| **Governed refresh cadence** | One daily dispatcher cron fans out to all `LIVE` datasets based on each one's `scheduledFrequencyHours` vs `lastSuccessAt`. Staleness beyond a threshold fires alerts and audit events. OFAC's ~20k-entry SDN list is streamed via a durable job to avoid timeouts. | Platform Admin → `DatasetRefreshLog` runs; the staleness alert mechanism. |
| **Provenance on AI runs** | Every document parse records the model that actually ran (`DocumentParseVersion`), every classification extraction records its model (`AgentExecution`) — provenance can't claim one model while another did the reading. | Show a `DocumentParseVersion` row with its model. |
| **AI cost controls** | One shared counter (`AiUsageWindow`) meters every AI surface; per-account daily token ceilings and per-user/account rate limits are configurable. Metering is always on; enforcement is opt-in; a metering failure fails *open* so it can never block customs classification. | README "AI Cost Controls"; show `get_service_usage_summary` in chat. |

### Platform & integrations

| Feature | What the customer gets | Show it in the app |
|---|---|---|
| **Scoped partner API** | `/api/v1/*` routes authenticated by API key (`Bearer` / `X-Api-Key`), per-scope (`embargo.read` vs `embargo.screen`, etc.), idempotent, every action audit-logged `source: "API"`. Screening, classification, HTS, products, parties, regulatory, rulings, trade agreements, batch. | `/app/admin/integrations` → the API key panel and scopes. |
| **Platform Admin Console** | Cross-tenant administration: accounts, users, cron control, datasets, deployments, API catalog, memory, quarantined inbound, rate/keyword review. | `admin@qubere.ai` → `/platform-admin`. |
| **Environment fail-safes** | Demo/mock seeding is always blocked in production regardless of flags. Mock customs transmission and unscanned-upload acceptance are hard failures in production (surfaced in `/api/health`). | `/api/health` on a misconfigured environment shows the blockers explicitly. |

---

## Talking points

- **"Account is the boundary, and it's enforced in the data layer."** Not a view
  filter, not a middleware afterthought — one shared `@qubere/db` layer that
  every query goes through with `accountId` scoping.
- **"We publish which datasets are real."** The Zero-Fabrication matrix is a
  feature. Most competitors won't tell you what they've actually wired vs.
  what's a demo. Qubere shows you, in the admin console, with HTTP 422 on the
  un-wired ones.
- **"The audit log can't be turned off and can't block your work."** Immutable,
  best-effort, ~104 catalogued actions, with IP / user agent / request id.
- **"Support can't just look."** Platform RBAC is a separate role system;
  impersonation is banner'd and logged.
- **"Legally-binding data has a human gate."** A new tariff rate is staged DRAFT
  and a person publishes it — because that number ends up on a CBP filing.

## Objection handling

- **"SOC2 report?"** The architecture is SOC2-ready (immutable audit, RBAC,
  tenant isolation, least-privilege data access) — position readiness and the
  design; the formal attestation status is a sales-ops question, don't
  improvise it.
- **"Where is data hosted?"** Supabase PostgreSQL, object storage on Vercel Blob
  / GCS, Clerk for identity, IBM-hosted Docling for parsing, Gemini for
  reasoning. Get specifics from the current infra doc before committing regions.
- **"Can we self-host?"** The customs and TMS apps are Next.js; the document
  worker runs as a long-lived process on any host. A fully air-gapped deployment
  isn't a packaged offering — scope it as an enterprise engagement.
- **"Data deletion / export on termination?"** Bulk shipment/document export
  exists. A formal end-of-contract data-return/purge runbook is an enterprise
  contract item, not a self-serve button.
- **"Penetration testing?"** Portal and billing tenant-isolation both went
  through formal internal security review with automated regression tests added
  — reference those; external pentest cadence is a sales-ops answer.

## Demo setup

Use `admin@qubere.ai` for the Platform Admin Console and the dataset registry.
Use `sarah@target.com` vs `admin@target.com` for the row-level-security contrast.
Have `/app/admin/roles` and `/app/admin/integrations` ready.

**Deeper reference:** README §1–6, "Platform Dataset Master Registry",
`docs/compliance-notifications-and-audit.md`, `PLATFORM_CAPABILITIES.md`.
