# Private Embargo Screening

Private Embargo Screening lets one tenant layer its own country-pair policy
on top of the government-source Country Embargo engine, without touching that
engine's own logic. It is an overlay, not a second embargo matcher.

## What a private rule is

A `PrivateEmbargoRule` (`packages/db/prisma/schema.prisma`) is a tenant-owned
**country-pair** row — nothing more granular than that. No HTS/ECCN or
party-type fields exist on the model; it is purely `fromCountryCode`
(nullable) + `appliesToAllFromCountries` (wildcard) → `toCountryCode`,
`embargoed: true` (only `true` ever produces a hit — there is no
allow-list/exemption mechanic), an optional `effectiveDate`/`expirationDate`
window, free-text `reason`/`reference`, and a soft `status`
(`ACTIVE`/`DISABLED` — a rule is never physically deleted, for audit
retention). Every rule carries `accountId`; there is deliberately no
"Account Group" concept, so scoping is a direct per-account ownership check,
never a broader tenant grouping.

## How it fits into `doEmbargoCheck`

`privateEmbargoMatcher.ts` runs **first** inside `doEmbargoCheck.ts`, but only
when the account has turned it on (`accountConfig.privateEmbargoEnabled`). A
non-match returns `SKIPPED` and falls straight through to the government-source
matchers (US/generic/standard) — a private rule can never manufacture a
`CLEAR`, only add a `HIT` on top of what the government-source data would
otherwise produce. Only an actual active, in-window rule match short-circuits
the check, as a `HIT` with `matcher: "PRIVATE"`. The precedence ordering
between matcher tiers is called out in a `doEmbargoCheck.ts` comment as a
known gap — no source spec fixes the order, so the current sequence is "the
most literal reading" of a conceptual list, and any future correction belongs
in the dispatch function, never inside a matcher.

## Admin surface, RBAC, and audit

`PrivateEmbargoRulesPanel.tsx` (`/app/admin/settings`) lets an admin toggle
private screening on/off for the account, create a new rule, and disable
(soft-delete) an existing one — there is no edit UI wired up today even
though the `PATCH .../[id]` route exists. Both API routes
(`api/admin/settings/private-embargo-rules/**`) are gated by the
`settings.manage` permission and re-check `accountId` ownership on every
mutation rather than trusting the route parameter. CRUD actions are
audit-logged (`PRIVATE_EMBARGO_RULE_CREATED`/`_UPDATED`/`_DISABLED`,
`PRIVATE_EMBARGO_SCREENING_TOGGLED`); a screening-time hit itself is not a
generic `AuditLog` row — like every embargo check, it's persisted as an
`EmbargoUsageLine` under the run's `EmbargoUsageHeader` (result code `F` for
hit), gated by the account's own audit-usage setting.

## Known gaps

- No cross-account "group" scoping — rules are single-account only.
- `embargoed: true` is the only rule polarity; there's no allow-list override
  to carve an exception back out of a government-source hit.
- Matcher-tier precedence is explicitly flagged as unverified against any
  authoritative source.
