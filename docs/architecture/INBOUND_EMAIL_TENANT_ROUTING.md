# Tenant-safe inbound document email

## Decision

Use one receiving domain and issue an opaque address for each destination:

```text
docs-<random-token>@inbound.qubere.ai
```

The token maps to exactly one Qubere account and, when needed, one client workspace. The recipient selects the destination; the sender address is a separate authorization check. Never infer an account from the sender's domain, subject, attachment contents, or an AI result.

Resend accepts mail for any address at a verified receiving domain and includes the recipients in the `email.received` event. A separate DNS record is therefore unnecessary for every account or client. See [Receiving Emails](https://resend.com/docs/dashboard/receiving/introduction), [Receiving Domains](https://resend.com/docs/dashboard/receiving/custom-domains), and the [email.received webhook](https://resend.com/docs/webhooks/emails/received).

## Why this model

| Option | Decision | Reason |
| --- | --- | --- |
| `docs@target.inbound.qubere.ai` | Reject | Requires DNS/domain lifecycle per client and exposes a guessable tenant identifier. |
| `target@inbound.qubere.ai` | Reject as a security boundary | Operationally simple, but client slugs are guessable, mutable, and can collide. A slug may be an optional forwarding alias only. |
| `docs-<opaque-token>@inbound.qubere.ai` | Adopt | No per-client DNS, stable across renames, hard to guess, and maps directly to one destination. |
| Shared `docs@inbound.qubere.ai` plus sender-only routing | Transitional only | A sender can legitimately serve multiple clients, so sender identity alone cannot always select the correct mailbox. |

## Routing contract

1. Verify the webhook signature and deduplicate the provider event.
2. Normalize all envelope recipients and resolve exactly one active inbound mailbox token.
3. If no mailbox matches, quarantine the email without assigning it to a tenant.
4. If more than one tenant mailbox is addressed, quarantine it as `ambiguous_recipient`.
5. Resolve the normalized sender within the mailbox's account.
6. If the sender is blocked, reject it before downloading attachments.
7. If the sender is not active, store attachments in quarantine for that mailbox's account.
8. If both mailbox and sender checks pass, create documents only inside that account/client boundary.

The mailbox lookup is the tenant boundary. Sender authorization controls whether mail may proceed automatically. Possession of an address token alone is not authorization.

## Proposed data model

```text
InboundMailbox
  id
  tokenHash                 unique
  accountId
  clientId                  nullable
  label
  status                    ACTIVE | ROTATING | REVOKED
  createdAt
  rotatedAt                 nullable

InboundSenderRoute
  accountId
  normalizedSenderEmail
  status                    ACTIVE | SUSPENDED | REVOKED | BLOCKED
  defaultAssignedToUserId   nullable
  unique(accountId, normalizedSenderEmail)

InboundEmail
  inboundMailboxId          nullable during legacy transition
  accountId                 nullable until recipient resolution
  original recipients and existing audit fields
```

Store only a hash of the mailbox token if routing can hash the normalized local part before lookup. Display a redacted address in logs and UI. Tokens should have at least 128 bits of entropy and support rotation with a short overlap window.

The sender uniqueness constraint should become account-scoped. The same freight partner may be authorized for more than one account; requiring global uniqueness forces sender identity to double as tenant routing, which is precisely what the mailbox token replaces.

## Product behavior

- Account settings show the account-level address and optional client-specific addresses.
- Copying an address includes a warning that it should be shared only with expected senders.
- Quarantine lives in Docs and is scoped to the signed-in account. Platform admins can assign legacy, unaddressed items across accounts.
- Release requires a destination account. It may remember the sender for that account only.
- Block creates an account-scoped block rule; it must not globally block a supplier used by another account.
- Every release, discard, block, token creation, and token rotation is audited.

## Migration

1. Add `InboundMailbox` and account-scoped sender uniqueness.
2. Issue one opaque account mailbox per account and optional mailboxes per client workspace.
3. Update the webhook to resolve the recipient before the sender.
4. Continue accepting `docs@inbound.qubere.ai`, but quarantine it unless its sender has one unambiguous legacy route.
5. Show migration status in settings and notify customers of their new address.
6. After an adoption window, stop automatic processing through the shared address; retain quarantine temporarily, then retire it.

## Observability and acceptance tests

- Log mailbox ID and account ID, never the raw token.
- Alert on unknown recipients, multi-tenant recipient sets, and legacy-address volume.
- Test that a sender authorized for account A cannot release into account B.
- Test that a sender shared by accounts A and B routes correctly when each account's mailbox is used.
- Test revoked and blocked mailbox tokens, sender reactivation, bulk quarantine actions, retries, and duplicate webhooks.
- Verify every database read and write in the worker runs in an explicit system context and carries the resolved account boundary.
