# Compliance Email Notifications & Audit Logging

Two separate but related mechanisms: an outbox-based email pipeline that
alerts humans to specific compliance events, and a passive, best-effort audit
trail that records what happened for later review — the two do not depend on
each other, and a notification failure never blocks or rolls back the
compliance action it was about.

## Email notifications

### Outbox / queue pattern

A compliance event doesn't send an email directly. It writes a
`ComplianceNotification` row (an outbox entry), and a separate dispatcher
picks it up later:

`src/modules/compliance/notifications/dispatcher.ts` →
`ComplianceNotificationDispatcher.dispatchPending()` claims pending rows with
an optimistic `updateMany({ where: { status: "PENDING" }, ... })` — the same
claim-then-process pattern `CommunityScreeningDispatcher` uses, so a crashed
or retried dispatch tick can never double-send the same notification. Failed
sends are retried with backoff rather than dropped.

### What triggers a notification today

Notification types span two domains, sharing one dispatcher/outbox:
`RPS_HIT`, `RPS_REVIEW_REQUIRED`, `PAL_RESCREEN_HIT`, `PARTY_RESCREEN_HIT`
(`src/modules/compliance/notifications/templates/notificationLabels.ts`), plus
`LICENSE_ALERT` (portfolio expiry/utilization-threshold digest, one email per
account per day, see `licenseEligibility.ts`/`licenseNotificationService.ts`)
and `LICENSE_DETERMINATION_REVIEW_REQUIRED` (queued when a License
Determination result lands on `REVIEW_REQUIRED`/`BLOCKED`). The two License
types render from a `payload` column snapshotted at queue time rather than
re-querying a live result row, since a portfolio digest has no single backing
record. There is **no** embargo-hit notification type and no broader
PAL-lifecycle notification (e.g. "approval expiring soon") — those are gaps,
not placeholders with dead code behind them.

### Recipients and eligibility

`recipients.ts` resolves a per-account distribution list rather than a single
fixed address; `eligibility.ts` decides whether a given event/account
combination should notify at all before a row is even queued.

### Delivery

`src/modules/email/`: `emailProviderFactory.ts` selects a provider by config;
today the only implementation is `smtpEmailProvider.ts` — there is no
dev/mock provider, so exercising the send path in an environment without a
real SMTP endpoint configured will fail rather than log-and-skip.

## Audit logging

### Mechanism

`createAuditLog` (re-exported from `src/lib/audit.ts`, implemented in the
shared `@qubere/decisions` package's `audit.ts`) is the single write path for
an `AuditLog` row. It is **best-effort**: a logging failure does not use
`failClosed` semantics and does not roll back or block the action being
audited — the action always completes even if its audit record doesn't.

### The action catalogue

`src/lib/audit/auditActions.ts` defines the `AuditAction` enum — roughly 104
values across every compliance domain (private embargo rules, PAL grant/
revoke, RDPS runs, Community Screening create/rescreen/export, settings
changes, and more). The catalogue is comprehensive, but `createAuditLog`'s
`action` parameter is typed as a loose `string`, not constrained to the enum
— so a call site can pass an arbitrary string that compiles cleanly but never
matches any cataloged action, and nothing at the type level catches that.

### Where audit history is surfaced

- `AuditHistoryPanel.tsx` / `ExecutionHistoryPanel.tsx`
  (`src/app/app/compliance/`) — compliance-run-level audit view.
- `SettingsAuditPanel.tsx` (`src/app/app/admin/settings/`) — admin-settings
  audit view, backed by `src/lib/admin/auditData.ts`.
- `api/audit/export/route.ts` — CSV export of the audit trail for a given
  scope, gated the same way the panels are.

### Formal overrides

A `ComplianceFormalOverride` is a distinct, human-only correction of a
compliance decision — separate from a domain's own reviewer disposition
field (e.g. License Determination's `reviewerDisposition`) — recorded via
`createFormalOverride`/`revokeFormalOverride`
(`src/modules/compliance/formalOverride.ts`) and exposed as
`POST /api/v1/compliance/overrides` / `POST /api/v1/compliance/overrides/[id]/revoke`,
both gated by `compliance.override`. It is domain-agnostic (`resultRefType`/
`resultRefId` are plain strings, not a relation), so it applies uniformly
across every `ComplianceExecution` type. `ExecutionHistoryPanel.tsx`'s
execution detail view surfaces a create-override form and a per-active-
override revoke control, gated by the same permission.

### Retention

There is no retention or purge policy — `AuditLog` rows accumulate
indefinitely; nothing in this codebase schedules a cleanup.

## Known gaps

- Email: no embargo-hit or PAL-lifecycle notifications; SMTP-only provider
  with no local/dev fallback.
- Audit: `action` parameter not type-checked against the `AuditAction` enum;
  logging is best-effort (never blocks the audited action); no retention
  policy.
