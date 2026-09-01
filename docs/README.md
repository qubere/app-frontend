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

## Quick links

### Customs
- [Customs filing overview](apps/customs/feature/customs-filing/00-README.md)
- [UI config framework](apps/customs/feature/ui-config/UI-CONFIGURATION-FRAMEWORK.md)
- [ABI / CATAIR](apps/customs/feature/abi/)
- [OpenAPI spec](apps/customs/data/openapi.yaml)
- [ADRs](apps/customs/planning/adr/)
- [Open items](apps/customs/planning/review/OPEN-ITEMS.md)
- [Sales decks](apps/customs/sales/)

### TMS
- [Modular agent architecture](apps/tms/feature/TMS-MODULAR-AGENT-ARCHITECTURE.md)
- [Multi-leg shipments](apps/tms/feature/MULTI-LEG-SHIPMENTS.md)
- [Open items](apps/tms/bugs/TMS-OPEN-ITEMS.md)
- [Sales](apps/tms/sales/)

### WMS
- Placeholder — no docs yet; see `apps/wms/future/`
