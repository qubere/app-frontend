# Document Intake Improvements

Branch: `feat/document-intake-improvements` (off `main` @ 64a33b95)

Raises the "Document intake" capability from ~63% by closing the gaps in the
audit assessment: the unattached-doc → suggested-shipment → one-click-attach
loop, real multi-field match scoring, evidence-in-decision on the Actions
screen, intake API hardening, and adding malware scanning to the pipeline.

## Workstreams

### A. Matching engine — weighted, multi-identifier (`shipmentMatching.ts`)

Today: only `SHP-####-######` and a PO regex, exact DB lookup, hardcoded
`confidenceScore = 1.0`.

- Extract additional identifier tokens from email subject + parsed text:
  container (ISO 6346), MBL/HBL, booking, MAWB/HAWB.
- Resolve them against the existing `ShipmentTrackingIdentifier` table
  (`TrackingIdentifierType` already has MBL/HBL/BOOKING/CONTAINER/MAWB/HAWB/PRO/
  TRACKING; `@@index([accountId, type, value])`).
- `scoreCandidate()` — weighted per identifier type, with an agreement bonus
  when ≥2 independent identifiers point at the same shipment and a penalty for
  a single weak signal:
  - SHIPMENT_NUMBER 0.95, MBL 0.90, HBL 0.88, CONTAINER 0.80, BOOKING 0.78,
    MAWB 0.85, HAWB 0.83, PO_REFERENCE 0.50
  - +0.15 per additional agreeing distinct identifier type (cap 1.0)
  - container check-digit validation; invalid → 0.55
- Thresholds: ≥0.85 auto-attach, 0.50–0.85 suggestion only, <0.50 dropped.
- `recordCandidate` writes the real score + `scoreBreakdown` JSON +
  `algorithmVersion = "v2-weighted-multi-identifier"`.

Schema: `DocumentShipmentCandidate` add `matchMethod String?`,
`scoreBreakdown Json?`. Migration `20260830030000_document_intake_improvements`.

Populate `ShipmentTrackingIdentifier` from extraction: after a document is
attached and structured extraction completes, upsert recognised identifiers
(container/BOL/booking) onto the shipment so future documents match on them.

### B. Candidate picker UI (`DocumentsClient.tsx`)

The attach popover currently lists every active shipment alphabetically and
ignores `doc.shipmentCandidates` (already returned by
`/api/documents/unattached`).

- Render candidates first as ranked suggestions: shipment #, port of entry,
  matched-identifier chip, confidence %. One click → attach.
- Keep the full-shipment list below as "search all shipments" fallback.

### C. Match-conflict lane (Actions / Today)

`matchShipmentForDocument` persists conflicting candidates but nothing surfaces
them.

- Action-item producer: unattached document with ≥2 distinct candidate
  shipments → "Document matched N shipments — confirm".
- Resolve = attach to the chosen shipment (reuses the attach route).

### D. Evidence viewer in decision cards (`ActionsClient.tsx` `DecisionBody`)

Cards render scalar rows only. `ExtractionField` rows carry
bbox/page/confidence/source but never reach the card.

- "Evidence" expander listing the `ExtractionField` rows behind the decision.
- Deep-link each into the PDF canvas viewer at the right page with the bbox
  highlighted.

### E. Intake API hardening (`/api/v1/intake/document`)

- Accept a batch body (`{ documents: [...] }`, cap 25) alongside the single
  form; unify the code path.
- 422 with per-item `issues` on partial validation failure.
- Return resolved/auto-attach candidate matches inline in the response.

### F. Malware scanning — ClamAV

See "Malware scanning" section below. `MalwareScanner` interface +
`ClamdScanner` (INSTREAM) + `NullScanner` (dev). Scan raw bytes before parse in
`documentProcessingWorker` / `DocumentIntelligenceAgent` / upload route.
Positive or scanner-unavailable → `malwareScanStatus` set, document quarantined,
audit + Today-lane alert, no parse.

Schema: `ShipmentDocument` add `malwareScanStatus String @default("PENDING")`
(PENDING/CLEAN/INFECTED/SKIPPED/ERROR), `malwareScanDetail String?`,
`malwareScanAt DateTime?`.

## Malware scanning — tool choice

Constraint: Vercel serverless functions + GCS storage + Inngest steps. `clamd`
needs ~1.4 GB resident RAM and a persistent process — it cannot run inside a
Vercel function.

| Option | Infra | Cost | Files leave our infra? | Notes |
|---|---|---|---|---|
| **ClamAV `clamd` on Cloud Run** (recommended) | 1 container, min-instances 1 | ~$15–40/mo | No | Self-hosted; app streams bytes over INSTREAM TCP from an Inngest step. Free/OSS. Confidential trade docs stay in our infra. |
| GCS-event ClamAV (Google reference arch) | Cloud Run + 2 buckets + Eventarc | similar | No | More moving parts; adds latency before the app sees the file. |
| OPSWAT MetaDefender Cloud | none | free tier → per-scan | Yes | 30+ AV engines, hash-lookup-first REST API. Check DPA vs customer contracts. |
| Cloudmersive Virus Scan API | none | cheap | Yes | Simple REST, fewer engines. |
| VirusTotal | none | free (4 req/min public) | **Yes — uploads become visible to VT customers** | Use hash lookup only, never upload trade docs. Good as a fast known-bad pre-check. |

**Recommendation:** ClamAV `clamd` on Cloud Run as the primary scanner behind a
`MalwareScanner` interface, fail-closed (quarantine on infected *or* scanner
unreachable). Optional VirusTotal **hash-only** pre-check for instant known-bad
rejection at zero data-exposure cost. Revisit OPSWAT if we want multi-engine
coverage and are comfortable sending documents to a third party.

## Status

- [x] A. Matching engine — `identifierExtraction.ts` + weighted `shipmentMatching.ts` + `trackingIdentifierSync.ts`; migration `20260830030000`
- [x] B. Candidate picker UI — `AttachPopover` in `DocumentsClient.tsx`
- [x] C. Conflict lane — `DOCUMENT_MATCH_CONFLICT` notification + Documents-page badge; cleared on attach
- [x] D. Evidence viewer — `EvidenceExpander` on decision cards + `initialFieldName` deep-link into `DocumentReviewPanel`
- [ ] E. Intake API hardening
- [ ] F. Malware scanning

Migration `20260830030000` applied directly to the shared Supabase DB via
`prisma db execute` (idempotent `IF NOT EXISTS`); the `_prisma_migrations`
table there is already 25 migrations behind repo state, so `migrate deploy`
was not run.
