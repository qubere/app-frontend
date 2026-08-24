# Qubere Autonomous Freight Execution TMS (`@qubere/tms`)

**Qubere TMS** is an AI-native Autonomous Freight Execution and Transportation Management System built for logistics operators, freight forwarders, and dispatchers.

- **App Workspace**: `apps/tms`
- **Default Local Port**: **`http://localhost:3001`**
- **Framework**: Next.js 16 (App Router, Server Components) + Tailwind CSS + Supabase PostgreSQL + Prisma ORM + Google Gemini 3.6 Flash / IBM Docling PDF pre-parser

---

## 🔑 Login & Test Credentials

Default password for all seeded test accounts: **`QuberePass2026!`**

| Email | Account Context | Role | Purpose / Access |
| :--- | :--- | :--- | :--- |
| `admin@qubere.ai` | Qubere Platform + Acme Corp | `PLATFORM_ADMIN` / `OWNER` | Full TMS Dispatcher & Platform Administration |
| `admin@target.com` | Target (`ENTERPRISE`) | `ADMIN` | Enterprise Account Admin |
| `sarah@target.com` | Target (`ENTERPRISE`) | `PLANNER` | Logistics Planner & Shipment Document Intake |
| `owner.acme@qubere.ai` | Acme Corporation (`ENTERPRISE`) | `OWNER` | Enterprise Logistics Manager |
| `joe@target.com` | Target (`ENTERPRISE`) | `ADMIN` | Enterprise Account Admin |

---

## 🤖 6 Autonomous Pipeline Agents

When a logistics document (Bill of Lading, Air Waybill, Commercial Invoice, Packing List, Booking Request, Carrier Invoice) is uploaded or attached to a shipment, Qubere's 6-stage autonomous agent pipeline fires in the background:

```
[1. Document Intake Agent]
  │ ── Classifies document type & extracts 100% of visible freight facts
  │ ── Captures rawMetadataJson, lineItems, and unmapped key-value pairs
  ▼
[2. Shipment Enrichment Agent]
  │ ── Promotes route (Origin, Destination, Mode, Discharge Port) to Shipment DB row
  │ ── Synchronizes MBL, HBL, Booking #, Container #, and Equipment requirements onto TransportationOrders
  ▼
[3. Document Readiness Agent]
  │ ── Verifies mode- & customs-dependent document completeness via RAG account memory
  │ ── Raises/resolves ExceptionItems automatically
  ▼
[4. Movement Readiness Agent]
  │ ── Validates positioning, stops, equipment availability, and tracking references
  ▼
[5. Cost & Carrier Readiness Agent]
  │ ── Audits linehaul/drayage rates, tenders, and buy/sell margins against target margins
  ▼
[6. Operational Risk Agent]
  │ ── Assesses tracking freshness, customer promise buffers, LFD detention risks, and exceptions
  │ ── Assigns real-time shipment health status (Healthy, At Risk, Critical)
```

---

## 🔒 Additive Intelligence & Zero Data Loss Mandate

1. **Complete Content Capture**: The intake engine pre-parses documents via IBM Docling and Google Gemini 3.6 Flash, extracting standard fields alongside `rawMetadataJson` and `lineItems`. Contact names, emails, phone numbers, cut-off dates, ETD/ETA dates, move types (`FCL/FCL`), vessel/voyages, packing numbers, and unmapped fields are never discarded.
2. **Additive State Chain**: `pipelineJob.state.accumulatedData` accumulates agent outputs at each stage without overwriting or deleting prior evidence.
3. **Non-Blocking Ingestion**: Document uploads close instantly (`202 Accepted`) and stream ribbon status updates in real-time as background processing completes.

---

## 🚀 How to Run locally

```bash
# From workspace root:
npm run dev --workspace=@qubere/tms

# Or run typecheck:
npm run typecheck --workspace=@qubere/tms

# Or run vitest unit tests:
npx vitest run apps/tms/tests/
```
