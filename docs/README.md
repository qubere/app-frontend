# Qubere Docs

New engineers should begin with the [Development Guide](DEVELOPMENT_GUIDE.md),
which explains repository navigation, file ownership, implementation workflow,
tenant-safety rules, database migrations, testing, and debugging.

App reference docs live under `docs/apps/<app>/`, organized by type. Shared
release guidance, operations runbooks and demo walkthroughs also live under
`docs/product-help/`, `docs/operations/` and `docs/sales/`.

## Structure

```
docs/apps/
  customs/          Customs-broker platform (primary app)
  tms/              Transport Management System
  wms/              Warehouse Management System (future)
```

### Per-app folders

| Folder | Contents |
|--------|----------|
| `feature/customs-filing/` | Customs Filing module documentation package (`00`–`06`) |
| `feature/ui-config/` | UI-configuration framework reference |
| `feature/abi/` | CATAIR source PDFs + the field→DB coverage table |
| `data/` | Data models, schemas, field dictionaries, API spec |
| `ops/` | Runbooks, infra, email/domain setup |
| `support/` | Help center and broker support docs |
| `sales/` | Sales decks, demo playbooks, pitch docs |
| `planning/adr/` | Architecture Decision Records |

## The backlog lives in GitHub Issues

Every gap analysis, proposal, `future/` spec, feature spec, feature explainer,
open-item list, roadmap, and audit snapshot that used to live in `bugs/`,
`future/`, `planning/`, `planning/features/`, and loose under `feature/` has been
migrated to GitHub Issues so the build backlog is filterable in one place.
`bugs/` and `future/` no longer exist; `planning/` is now just `adr/`. `feature/`
keeps only the `customs-filing/`, `ui-config/`, and `abi/` reference sets (plus
the F16 onboarding spec, which is too large for an issue body — see #288).

Each backlog issue carries four labels and opens with an `<Area><impact><effort>` tag:

- `backlog`
- `area:*` — brokerage-os · compliance · post-entry · billing · cross-cutting · tms
- `impact:*` — critical · high · medium · low (impact on the customer)
- `effort:*` — high · medium · low (effort to get it done)

Start at the [**backlog index**](https://github.com/qubere/app-frontend/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog) (#226),
or filter, e.g. [`label:backlog label:impact:critical`](https://github.com/qubere/app-frontend/issues?q=is%3Aissue+is%3Aopen+label%3Abacklog+label%3Aimpact%3Acritical).
Issues titled `[archive]` are point-in-time audit/review snapshots kept for the record.

Docs that remain in `docs/` are **reference** material (data models, architecture,
ADRs, customs-filing module docs, UI-config framework, sales decks, TMS architecture).

## Quick links

### Customs
- [Customs filing overview](apps/customs/feature/customs-filing/00-README.md)
- [UI config framework](apps/customs/feature/ui-config/UI-CONFIGURATION-FRAMEWORK.md)
- [ABI / CATAIR](apps/customs/feature/abi/)
- [OpenAPI spec](apps/customs/data/openapi.yaml)
- [ADRs](apps/customs/planning/adr/)
- [Sales decks](apps/customs/sales/)
- [Client email: customer and broker instructions](apps/customs/support/CLIENT-EMAIL-DOCUMENTS.md)
- [Client email: sales walkthrough](sales/CLIENT-EMAIL-INGESTION-DEMO.md)
- [Client email: rollout and rollback](operations/CLIENT-EMAIL-INGESTION-ROLLOUT.md)
- [End-to-end demo: inbound email to transmitted customs filing](sales/END-TO-END-EMAIL-TO-FILING-DEMO.md)
- [Trade Repository & Trade Data](apps/customs/sales/TRADE-REPOSITORY-AND-TRADE-DATA.md)

### TMS
- [Modular agent architecture](apps/tms/feature/TMS-MODULAR-AGENT-ARCHITECTURE.md)
- [Sales](apps/tms/sales/)

### WMS
- Placeholder — no docs yet; see `apps/wms/future/`
