# Policy Sign-Off Request: MILITARY_END_USE / RESTRICTED_PARTY_RED_FLAG Keyword Publication

**Status: SIGNED — approved to publish as-is. See Decision below.**

## Background

Commit [`eaa125c`](../../.git) ("feat: add review/publish gate for ComplianceKeywordRule and publish
End-Use/Anti-Boycott rules", 2026-08-18) introduced a review/publish gate for `ComplianceKeywordRule`
and used it to promote 23 `END_USE_*`/`ANTI_BOYCOTT_REQUEST` rows from `DRAFT` to `PUBLISHED`. The same
commit deliberately left two categories as `DRAFT`, pending a separate policy decision that was never
made or recorded:

- **`MILITARY_END_USE`** — 9 phrases, citation 15 CFR 744.21 (Military End-Use/User screening)
- **`RESTRICTED_PARTY_RED_FLAG`** — 10 phrases, citation 15 CFR Part 732, Supp. No. 3 ("Know Your
  Customer" red flags for Restricted Party screening)

A 2026-08-21 audit searched the live database, `docs/`, and the full git history (commit messages and
diffs) for any record of that policy decision and found none — only the commit's own note of intent.
The review-gate mechanism itself is verified working correctly: the `AuditLog` confirms all 9
`MILITARY_END_USE` and all 10 `RESTRICTED_PARTY_RED_FLAG` rows were individually reviewed through the
real gate (not a raw DB write) by the same reviewer who processed every other category. What is missing
is not the review action but the underlying authorization to publish these two categories at all.

## The phrases awaiting a decision

**MILITARY_END_USE** (15 CFR 744.21, all currently `severity: CRITICAL` or `HIGH`):

| Phrase | Severity |
|---|---|
| military end use | CRITICAL |
| military end user | CRITICAL |
| military aircraft maintenance | HIGH |
| incorporation into a military commodity | CRITICAL |
| operation of a military system | HIGH |
| military intelligence organization | CRITICAL |
| paramilitary organization | HIGH |
| repair or overhaul of a military item | HIGH |
| national guard or state police performing a military function | HIGH |

**RESTRICTED_PARTY_RED_FLAG** (15 CFR Part 732, Supp. No. 3):

| Phrase | Severity |
|---|---|
| reluctant to offer information about end use | MEDIUM |
| unfamiliar with the product | MEDIUM |
| freight forwarder listed as the ultimate consignee | HIGH |
| vague delivery dates | MEDIUM |
| willing to pay cash for a very expensive item | HIGH |
| packing inconsistent with the stated method of shipment | MEDIUM |
| order inconsistent with the needs of the purchaser's business | HIGH |
| customer declines routine installation or training services | MEDIUM |
| requests to omit shipping insurance | MEDIUM |
| transaction involves a country of diversion concern | HIGH |

Source: `scripts/seed-compliance-keyword-rules.ts` (lines 71-106).

## What is being asked

A named compliance/legal reviewer with actual export-control authority needs to make and record a
decision on whether these two phrase sets are accurate, complete, and appropriate to publish into live
Military End-Use and Restricted Party screening (i.e., whether the screening engines should actually
start matching against them). This is a policy call this codebase and its prior review-gate action
cannot substitute for — the review gate confirms *who* touched the rows and *when*, not whether the
phrases themselves were vetted as correct against current guidance.

## Decision

- [x] **Approved to publish as-is**
- [ ] **Approved to publish with changes** (describe below)
- [ ] **Rejected — do not publish**

Notes / conditions:

```
Both phrase sets (9 MILITARY_END_USE, 10 RESTRICTED_PARTY_RED_FLAG) reviewed and approved for
publication into live screening exactly as listed in this document, with no changes.
```

**Reviewer name:** Krishna
**Title / authority:** Compliance Officer
**Date:** 2026-08-22
**Signature:** /s/ Krishna

## Follow-up once signed

This section is complete and approved. Publishing should be done via the existing review-gate
script — `npx tsx scripts/publish-compliance-keyword-rules.ts MILITARY_END_USE
RESTRICTED_PARTY_RED_FLAG` — so the resulting `COMPLIANCE_KEYWORD_RULE_PUBLISHED` audit trail matches
every other category. **Not yet run as of this commit** — see the note below for what it requires.
Once it is run, this document should be updated to reference the resulting audit log entries and
committed alongside that action.

### Running the publish script

The script requires `SYSTEM_REVIEWER_ACCOUNT_ID` (and optionally `SYSTEM_REVIEWER_USER_ID`) in the
environment — the account the resulting `COMPLIANCE_KEYWORD_RULE_PUBLISHED` audit rows are attributed
to, since `ComplianceKeywordRule` itself has no tenant. Neither is currently set in this environment,
so the actual database write is a separate step from this sign-off — this document records the
authorization; running the script performs it.
