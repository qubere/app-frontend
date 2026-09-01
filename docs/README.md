# Qubere Docs

All docs live under `docs/apps/<app>/` organized by type.

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
| `feature/` | Live / in-progress feature specs and architecture docs |
| `planning/` | Project plans, roadmaps, ADRs, audit reports, requirements |
| `data/` | Data models, schemas, field dictionaries, API spec |
| `ops/` | Runbooks, infra, email/domain setup |
| `support/` | Help center and broker support docs |
| `sales/` | Sales decks, demo playbooks, pitch docs |
| `future/` | Unimplemented or speculative features |
| `bugs/` | Open gap analyses, perf issues, known deficiencies |

## Backlog is in GitHub Issues

The gap analyses, proposals, `future/` specs, and open-item lists that used to live in
`bugs/`, `future/`, and `planning/` have been migrated to GitHub Issues so the build
backlog is filterable in one place. Each issue carries three labels:

- `area:*` — brokerage-os · compliance · post-entry · billing · cross-cutting · tms
- `impact:*` — critical · high · medium · low (impact on the customer)
- `effort:*` — high · medium · low (effort to get it done)

Start at the [**backlog index issue**](https://github.com/qubere/app-frontend/issues) (label `backlog`),
or filter, e.g. `label:backlog label:impact:critical`.

Docs that remain here are **reference** material (data models, architecture, ADRs,
customs-filing module docs, UI-config framework, sales decks, completed audit snapshots).

## Quick links

### Customs
- [Customs filing overview](apps/customs/feature/customs-filing/00-README.md)
- [UI config framework](apps/customs/feature/ui-config/UI-CONFIGURATION-FRAMEWORK.md)
- [ABI / CATAIR](apps/customs/feature/abi/)
- [OpenAPI spec](apps/customs/data/openapi.yaml)
- [ADRs](apps/customs/planning/adr/)
- [Sales decks](apps/customs/sales/)

### TMS
- [Modular agent architecture](apps/tms/feature/TMS-MODULAR-AGENT-ARCHITECTURE.md)
- [Data model review](apps/tms/planning/TMS-DDL-REVIEW.md)
- [Sales](apps/tms/sales/)

### WMS
- Placeholder — no docs yet; see `apps/wms/future/`
