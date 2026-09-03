# PGA holds and assist registry

Source: [PGA-HOLD-RESOLUTION-AND-ASSISTS](../future/PGA-HOLD-RESOLUTION-AND-ASSISTS.md).

## Broker workflows

- Today lists open agency holds by shipment, age, and filing deadline. Reviewers can filter the portfolio by agency or importer.
- The shipment drawer retains the original notice, entry-derived preparation, a 24-hour draft, and the submission history; the history is paged (`GET /api/pga/holds/[id]/submissions?page=`, 20 per page) rather than loaded in full. Rejections identify fields needing correction. A version conflict preserves the broker's input and compares it with the saved version before either is selected.
- Brokers record the reference and exact message after filing through their existing ACE channel, including responses recorded after the fact for a hold already filed outside this flow. Recorded agency responses update only the addressed hold. This workflow does not claim to transmit to ACE or confirm agency acceptance.
- Released holds stay discoverable from shipment history: `GET /api/pga/holds?shipmentId=&includeClosed=true` includes them, and the default query excludes them so the open-work count stays accurate.
- The Assists registry supports Draft, Active, Suspended, and Amortized states. Supplier/manufacturer shortcuts prefill the applicable party roles. Drafts can be saved with description and total before the activation prerequisites are complete.
- Entry banners suggest active assists scoped to importer, supplier/manufacturer, and HTS or SKU. Brokers can include, override with a reason, or decline each assist. A conflict requires review and confirmation of the refreshed amount.

## Filing and accounting contract

The specification's API table suggests immediate declaration on `POST /declare`, while its complete broker journey requires declaration on entry submission. This implementation follows that journey: `/declare` and `/dismiss` save an AssistDecision; they do not debit the ledger.

The canonical FilingService publishes the entry, snapshot, assist declarations, balance updates, valuation record, audits, and notification outbox inside one serializable PostgreSQL transaction. Publication failure rolls these writes back together. Balance/version changes are returned as HTTP 409; no financial write is retried silently. Unique (assist, filing) declarations prevent resubmission from charging twice.

Allocations use Decimal and roundToCents. Line apportionment preserves the confirmed total and absorbs the final cent. Invoice and assist calculations share the filing's currency resolution. Declared FX, affected lines, operator, and override reason are frozen in the declaration; adjusted values flow through calculateCustomsValuation and the canonical payload.

Below-10% alerts use the existing compliance email dispatcher and account notification bell. An outbox key deduplicates the alert per assist warning epoch. Replenishment above the threshold and explicit reactivation starts a new epoch. The compliance notification cron also suspends expired active assists.

## Delivery status and external prerequisites

| Area | Delivered behavior | Remaining prerequisite |
| --- | --- | --- |
| Notice ingestion | Validated, tenant-scoped normalized notice boundary and broker-recorded source evidence | Verified CBP/PGA wire layouts and a connected inbound transport before automatic ingestion |
| FDA, USDA, EPA, FWS, CPSC, NHTSA preparation | Agency-specific preparation checklists, entry provenance, draft recovery, review and manual evidence | Product and licensed-CHB approval of complete field matrices and field-to-record mappings |
| Message-set composition | Explicit PGA_MAPPING_NOT_APPROVED failure; no fabricated federal payload | Approved mappings, authoritative fixtures, and agency validation rules |
| Hold-code explanations | Original agency narrative is retained; source-backed dictionary interface exists | Authoritative hold-code catalog; no invented explanations |
| Agency submit/status | Manual filing and response evidence with permissions, versions and history | Production ACE credentials, transport adapter, and verified response decoding |
| Assist registry and declaration | Lifecycle, matching, allocation, staged review, atomic publication and immutable history | Existing filing configuration and dated FX data where conversion is needed |
| Assist alerts | Durable outbox, email dispatcher, bell deduplication, cron expiry | Existing configured email transport and scheduled compliance notification cron |

Unknown agencies permit source-notice export and do not permit submission through the supported-agency workflow. These boundaries are visible in the UI. This PR does not implement proactive PGA-by-HTS screening.

## Access and tenancy

All new API routes use withAuthenticatedRoute. PGA read/update/review/approve and valuation read/update/override retain their separate responsibilities. The declaration endpoint checks override permission in addition to write permission. Resource queries include accountId; foreign identifiers return not-found errors. Financial history has no edit/delete API.

Migrations are additive. They include account/status/date indexes, declaration uniqueness, nonnegative balance constraints, notification outbox fields, and source-request uniqueness.

## Verification

CI runs migration deployment and replay checks, workspace TypeScript, lint, PostgreSQL integration, the full unit suite, desktop/mobile Chromium checks, OpenAPI generation, and production build. Browser checks use production React components in an isolated Vite harness with HTTP fixtures; they do not bypass authentication in the deployed application. Route-permission tests use the production authentication guards with fixture identities. PostgreSQL tests exercise the real filing service, queries, transactions, snapshots and queue; only tariff catalog and schema catalog responses are fixtures.

Commands from the repository root:

```sh
npm run typecheck:workspaces
npm run lint
npm test
PGA_ASSIST_INTEGRATION=1 npm --workspace @qubere/custom run test -- tests/pga-assists.integration.test.ts
npm --workspace @qubere/custom exec -- playwright install chromium
npm --workspace @qubere/custom run test:e2e -- --config playwright.broker.config.ts
npm run openapi
npm run build
```

The integration test refuses to write unless DATABASE_URL targets localhost/qubere_test. It creates unique account fixtures, suppresses their notification outbox, and retires those accounts after testing. Their records remain in the disposable test database because audit logs are append-only; no audit trigger is disabled. The browser workflow uploads screenshots and failure traces as CI artifacts. Live federal transport and real authenticated browser sessions remain outside these automated fixtures.
