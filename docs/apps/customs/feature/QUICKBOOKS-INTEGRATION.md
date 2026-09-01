# QuickBooks Online Integration

First accounting integration. Standardized behind a provider-agnostic shape so
Xero / Sage / NetSuite can be added later without touching billing code.

## Status: Phase 1 + first sync (demo)

| Capability | State |
| --- | --- |
| OAuth 2.0 connect / callback / disconnect | ✅ built |
| Encrypted token storage + rolling refresh | ✅ built |
| Manual "Push to QuickBooks" on an invoice | ✅ built |
| Customer match/create, Invoice create (1 QBO line per Qubere line) | ✅ built |
| Sync log + idempotent entity map (no duplicate on re-push) | ✅ built |
| Auto-push on invoice approval | ⬜ later (emit an Inngest event from `approveInvoiceAction`) |
| Payment writeback (QBO → Qubere) | ⬜ later (webhook or poll) |
| Per-client QBO companies, per-charge-type items, tax codes | ⬜ later |

## Environment variables (`apps/custom/.env.local`)

```
QBO_ENVIRONMENT=sandbox                # sandbox | production
QBO_CLIENT_ID=...                      # Intuit app key
QBO_CLIENT_SECRET=...                  # Intuit app secret
QBO_REDIRECT_URI=https://<host>/api/integrations/quickbooks/callback
INTEGRATION_ENCRYPTION_KEY=<base64 32 bytes>   # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
INTEGRATION_STATE_SECRET=<random>      # optional; falls back to NEXTAUTH_SECRET
```

`QBO_REDIRECT_URI` must **exactly** match a Redirect URI registered on the
Intuit app (Keys & OAuth tab). For a Vercel preview, register the stable
preview host.

## Intuit app setup

1. developer.intuit.com → your app → **Keys & OAuth**.
2. Add the redirect URI above under **Redirect URIs**.
3. Scope: `com.intuit.quickbooks.accounting` (requested automatically).
4. Create / open a **sandbox company** for the demo (Sandbox tab).

## Demo script

1. Billing → Settings → **Connect QuickBooks** → approve on Intuit → card shows
   *Connected to <sandbox company>*.
2. Open an **APPROVED** or **SENT** invoice → **Push to QuickBooks**.
3. Button turns into **View in QuickBooks** → opens the created invoice in QBO
   with the mapped customer and line items.
4. Settings card shows the sync-log row; a second push is idempotent
   (*View in QuickBooks*, no duplicate).

## Code map

```
apps/custom/src/lib/integrations/
  crypto.ts                     AES-256-GCM for stored secrets
  quickbooks/
    config.ts                   env + endpoint/base-url resolution
    state.ts                    signed OAuth `state`
    oauth.ts                    authorize URL, code exchange, refresh, revoke
    client.ts                   connection load, token refresh, QBO API fetch
    mapInvoice.ts               Qubere Invoice -> QBO Invoice payload (pure)
    sync.ts                     ensureCustomer / ensureServiceItem / pushInvoice + logging

apps/custom/src/app/api/integrations/quickbooks/
  connect/     GET  -> redirect to Intuit
  callback/    GET  -> exchange code, store encrypted connection
  disconnect/  POST -> revoke + clear tokens
  status/      GET  -> UI status + recent sync logs

apps/custom/src/app/app/billing/settings/QuickBooksConnectionCard.tsx
apps/custom/src/app/app/billing/invoices/[id]/PushToQuickBooksButton.tsx
apps/custom/src/app/app/billing/invoices/[id]/actions.ts   (pushInvoiceToQuickBooksAction)
```

## Data model

`IntegrationConfig` gains OAuth columns (`realmId`, `accessTokenEnc`,
`refreshTokenEnc`, `tokenExpiresAt`, `refreshTokenExpiresAt`,
`providerAccountName`, `scopes`, `connectedByUserId`, `connectedAt`). The
account-wide QBO connection is the row with `provider = "QUICKBOOKS"` and
`clientId = null`.

New models:

- `IntegrationSyncLog` — one row per sync attempt (direction, entity, status,
  request/response JSON, duration).
- `IntegrationEntityMap` — unique on `(provider, realmId, qubereType, qubereId)`;
  makes re-sync idempotent.

Migration: `packages/db/prisma/migrations/20260830020000_quickbooks_integration`
(additive; safe to run on an existing DB).

## Notes / limitations

- `mapInvoice` uses one generic **"Customs Brokerage Services"** service item
  for every line (auto-created against the first Income account). Discounts and
  tax become explicit adjustment lines so the QBO total reconciles; a mismatch
  is flagged in the sync log, not blocked.
- `DocNumber` is the Qubere invoice number truncated to 21 chars (QBO limit).
- `CurrencyRef` is omitted — the sandbox US company's home currency (USD) is
  assumed. Multi-currency needs explicit handling.
- Token refresh persists the **rotated** refresh token every time (Intuit
  rotates it on each refresh).
