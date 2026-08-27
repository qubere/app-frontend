# Pre-Approved Party Lists (PAL)

PAL lets a compliance user record that a specific party identity has already
been cleared, so a future screening pass can reuse that decision instead of
re-running the Restricted Party Screening (RPS) engine — but only when the
reuse is provably still safe. The gate is fail-closed by design: any
ambiguity about identity, staleness, or revocation resolves to "screen again,"
never to "assume clear."

## The gate: `checkPreApprovalGate`

`checkPreApprovalGate()` (`src/modules/agents/compliance/restrictedParty/preApproval.ts`)
is the single reuse-eligibility check, called identically from the standalone
RPS flow and from Community Screening's `evaluateParty()`. It looks up an
active `PartyScreeningApproval` for the exact party and only returns a reuse
hit when **all** of the following hold:

- **Identity hash match.** The approval is keyed to a hash of the party's
  identity fields (name/address/country) at approval time — if today's
  snapshot hashes differently, the approval simply doesn't match and the gate
  is skipped, not overridden.
- **Party version match.** The stored `partyVersion` must equal the party's
  current version — an edited party invalidates its own approvals.
- **Reference-data freshness.** The approval must have been granted against
  reference data no older than the data the current screening run would use;
  a stale approval (granted before a denied-party list update) does not
  qualify.
- **Not expired.** `expiresAt`, if set, must be in the future.
- **Not revoked.** `status` must still be `ACTIVE` — a `REVOKED` row is
  never eligible again, even if every other condition would otherwise match.

Any failure in that chain is treated identically to "no approval exists" —
the caller falls through to a normal RPS run. There is deliberately no
"partial trust" tier.

## Lifecycle: creation, revocation, no TTL sweep

Approvals are created and revoked through the v1 API
(`src/app/api/v1/parties/[partyId]/restricted-party-screening/pre-approval/**`),
gated by `compliance.restricted_party_approve` (create) and
`compliance.restricted_party_revoke` (revoke) respectively. Every route is
wrapped in `withAuthenticatedRoute`, so approvals are always scoped to the
authenticated account, never a caller-supplied one.

There is **no scheduled expiry sweep** — an approval with `expiresAt` set
simply stops matching once that moment passes; nothing proactively flips its
`status`. A revoked approval's row is retained (soft state), giving a
permanent audit trail of who approved and who later revoked it.

## Shared identically across RPS and Community Screening

Community Screening's evaluator calls the exact same `checkPreApprovalGate()`
function, not a reimplementation — a PAL hit there short-circuits the RPS
engine entirely and is recorded as its own status (`PRE_APPROVED_REUSE`) and
finding category (`PAL_SUPPRESSED`), distinct from an ordinary `CLEAR`, even
though both aggregate to a passing outcome. See
[Community Screening](community-screening.md) for how that distinction is
surfaced end-to-end.

## Audit trail

Approval creation, revocation, and every gate reuse decision are captured via
`createAuditLog` (see [Audit Logging](compliance-notifications-and-audit.md)),
so a reviewer can trace which specific approval suppressed a given screening
pass and who was responsible for granting it.

## Known gaps

- No scheduled job expires stale approvals — expiry is enforced only at
  read-time inside the gate check itself.
- No bulk-approval workflow; approvals are created one party at a time.
