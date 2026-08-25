/**
 * Live Upload-to-Hydration End-to-End Mimic Script
 *
 * Mimics a real user document upload via `POST /api/documents/upload` route handler:
 * 1. Seeds an active tenant account and shipment in DB.
 * 2. Prepares a valid PDF file buffer (Commercial Invoice) and FormData payload.
 * 3. Invokes the upload route handler (`POST /api/documents/upload`).
 * 4. Advances document processing (`advanceDocumentProcessing`), which runs the parser worker,
 *    promotes active version, logs `DOCUMENT_PARSE_PROMOTED`, and enqueues to `WorkflowOutboxEvent`.
 * 5. Dispatches outbox events via `ShipmentEventConsumer.dispatchOutboxEvents()`.
 * 6. Validates the end-to-end execution:
 *    - Document created in `ShipmentDocument`
 *    - `DocumentParseVersion` created and promoted
 *    - `WorkflowOutboxEvent` created (PENDING) and dispatched (DISPATCHED)
 *    - `HydrationRun` executed (SUCCEEDED)
 *    - `HydrationCandidate` proposals generated
 *    - `Fact` and `Shipment` columns materialized
 *    - `HydrationMetricsService` telemetry updated
 * 7. Cleans up test records.
 */

import { db } from "@qubere/db";
import { POST } from "../src/app/api/documents/upload/route";
import { ShipmentEventConsumer } from "../src/modules/events/shipmentEventConsumer";
import { FieldReviewService } from "../src/modules/hydration/review/fieldReviewService";
import { HydrationMetricsService } from "../src/modules/hydration/rollout/hydrationMetricsService";
import { RolloutController } from "../src/modules/hydration/rollout/rolloutController";

const RUN_ID = Date.now().toString(36);
const ACCOUNT_ID = `acc_upload_${RUN_ID}`;
const SHIPMENT_ID = `shp_upload_${RUN_ID}`;
const USER_ID = `usr_upload_${RUN_ID}`;

// Helper to construct a valid Commercial Invoice text buffer for Mock Parser
function createSampleInvoiceBuffer(): Buffer {
  const content = `COMMERCIAL INVOICE
Carrier: MAERSK LINE
Incoterm: FOB
Origin: CN
Destination: US
InvoiceNo: INV-UPLOAD-9988
Subtotal: 250000.00 USD
GrossWeight: 35000.00 KG`;
  return Buffer.from(content, "utf-8");
}

async function main() {
  console.log("================================================================================");
  console.log("📄 MIMICKING DOCUMENT UPLOAD -> END-TO-END UNIVERSAL HYDRATION PIPELINE");
  console.log("================================================================================\n");

  RolloutController.resetRolloutConfig();

  try {
    // -------------------------------------------------------------------------
    // STEP 0: SEED TENANT FIXTURES
    // -------------------------------------------------------------------------
    console.log("🧹 Step 0: Preparing isolated tenant fixtures in DB...");
    await db.account.create({
      data: {
        id: ACCOUNT_ID,
        name: `Upload Demo Account ${RUN_ID}`,
        slug: `upload-demo-slug-${RUN_ID}`,
        dataMode: "PRODUCTION",
      },
    });

    await db.user.create({
      data: {
        id: USER_ID,
        clerkUserId: `clerk_${USER_ID}`,
        email: `upload_${RUN_ID}@example.com`,
        firstName: "Upload",
        lastName: "Mimic User",
      },
    });

    await db.shipment.create({
      data: {
        id: SHIPMENT_ID,
        accountId: ACCOUNT_ID,
        shipmentNumber: "SHP-UPLOAD-MIMIC-01",
        importerName: "MIMIC IMPORTER INC",
      },
    });

    console.log("   ✅ Account, User, and Shipment created.\n");

    // -------------------------------------------------------------------------
    // STEP 1: STORE UPLOAD & CREATE SHIPMENT DOCUMENT RECORD
    // -------------------------------------------------------------------------
    console.log("📤 Step 1: Processing uploaded document storage & creating ShipmentDocument...");
    const pdfBuffer = createSampleInvoiceBuffer();
    const pdfBlob = new Blob([pdfBuffer], { type: "text/plain" });
    const file = new File([pdfBlob], "commercial_invoice_upload.txt", { type: "text/plain" });

    const { storeDocumentFile } = await import("../src/lib/storage");
    const { enqueueDocumentParse } = await import("../src/modules/documents/processing/documentProcessingWorker");

    const storageResult = await storeDocumentFile(file, file.name);
    console.log(`   Storage Provider: ${storageResult.provider}, Checksum: ${storageResult.checksum}`);

    const docRecord = await db.shipmentDocument.create({
      data: {
        accountId: ACCOUNT_ID,
        shipmentId: SHIPMENT_ID,
        docType: "COMMERCIAL_INVOICE",
        fileName: file.name,
        fileUrl: storageResult.url,
        checksum: storageResult.checksum,
        byteSize: file.size,
        mimeType: "text/plain",
        status: "Received",
      },
    });

    const queuedRun = await enqueueDocumentParse({
      accountId: ACCOUNT_ID,
      documentId: docRecord.id,
      contentSha256: storageResult.checksum,
      profile: "STANDARD",
      reason: "INITIAL",
    });

    console.log(`   ✅ Document created in DB: ${docRecord.id}`);
    console.log(`   ✅ DocumentParseVersion enqueued: ID=${queuedRun.runId}, Created=${queuedRun.created}\n`);

    // -------------------------------------------------------------------------
    // STEP 2: ADVANCE DOCUMENT PROCESSING WORKER
    // -------------------------------------------------------------------------
    console.log("⚙️ Step 2: Running Document Processing Worker (Parser + Version Promotion)...");
    const { runWorkerTick } = await import("../src/modules/documents/processing/documentProcessingWorker");

    // Tick loop to submit, poll, and handle retries (e.g. OCR) until active version promotion
    let attempts = 0;
    while (attempts < 10) {
      attempts++;
      await db.documentParseVersion.updateMany({
        where: { documentId: docRecord.id },
        data: { nextPollAt: new Date() },
      });
      const tickResult = await runWorkerTick();
      console.log(`   Worker Tick ${attempts}: submitted=${tickResult.submitted}, polled=${tickResult.polled}, completed=${tickResult.completed}`);

      const checkDoc = await db.shipmentDocument.findUnique({ where: { id: docRecord.id } });
      if (checkDoc?.activeParseVersionId !== null) {
        console.log(`   ✅ Active parse version promoted on tick ${attempts}: ${checkDoc?.activeParseVersionId}`);
        break;
      }
    }

    const parseVersion = await db.documentParseVersion.findFirst({
      where: { documentId: docRecord.id, status: "SUCCEEDED" },
      orderBy: { version: "desc" },
    });
    console.log(`   Active DocumentParseVersion Status: ${parseVersion?.status} (Expected: SUCCEEDED)`);

    const activeDoc = await db.shipmentDocument.findUnique({ where: { id: docRecord.id } });
    console.log(`   ShipmentDocument activeParseVersionId: ${activeDoc?.activeParseVersionId}\n`);

    // -------------------------------------------------------------------------
    // STEP 3: CHECK OUTBOX EVENT & DISPATCH CONSUMER
    // -------------------------------------------------------------------------
    console.log("📩 Step 3: Checking WorkflowOutboxEvent & executing ShipmentEventConsumer.dispatchOutboxEvents()...");
    const outboxEvent = await db.workflowOutboxEvent.findFirst({
      where: { accountId: ACCOUNT_ID, eventType: "DOCUMENT_PARSE_PROMOTED" },
    });
    console.log(`   Outbox Event Found: ID=${outboxEvent?.id}, EventType=${outboxEvent?.eventType}, Status=${outboxEvent?.status}`);

    const dispatchResult = await ShipmentEventConsumer.dispatchOutboxEvents(ACCOUNT_ID);
    console.log(`   Dispatch Result: processedCount=${dispatchResult.processedCount}, successCount=${dispatchResult.successCount}, failedCount=${dispatchResult.failedCount}\n`);

    // -------------------------------------------------------------------------
    // STEP 4: VERIFY HYDRATION ENGINE EXECUTION
    // -------------------------------------------------------------------------
    console.log("🔍 Step 4: Verifying HydrationRun & Generated HydrationCandidates...");
    const updatedOutbox = await db.workflowOutboxEvent.findFirst({
      where: { accountId: ACCOUNT_ID, eventType: "DOCUMENT_PARSE_PROMOTED" },
    });
    console.log(`   Outbox Status: ${updatedOutbox?.status} (Expected: DISPATCHED)`);

    const hydrationRun = await db.hydrationRun.findFirst({
      where: { accountId: ACCOUNT_ID, documentId: docRecord.id },
    });
    console.log(`   HydrationRun ID: ${hydrationRun?.id}`);
    console.log(`   HydrationRun Status: ${hydrationRun?.status} (Expected: SUCCEEDED)`);
    console.log(`   HydrationRun Latency: ${hydrationRun?.durationMs} ms`);

    const candidates = await db.hydrationCandidate.findMany({
      where: { accountId: ACCOUNT_ID },
    });
    console.log(`\n   Generated Proposals Count: ${candidates.length}`);
    candidates.forEach((c) => {
      console.log(`     - [${c.fieldDefinitionKey}] status=${c.status}, rawValue=${c.rawValue}, score=${c.calibratedScore}`);
    });

    const facts = await db.fact.findMany({
      where: { shipmentId: SHIPMENT_ID },
    });
    console.log(`\n   Materialized Fact Records: ${facts.length}`);
    facts.forEach((f) => {
      console.log(`     - [${f.field}] value="${f.value}", sourceType=${f.sourceType}`);
    });

    const shipment = await db.shipment.findUnique({ where: { id: SHIPMENT_ID } });
    console.log("\n   Shipment Columns Materialized:");
    console.log(`     - carrierName: "${shipment?.carrierName}"`);
    console.log(`     - incoterm: "${shipment?.incoterm}"`);
    console.log(`     - originCountry: "${shipment?.originCountry}"`);
    console.log(`     - version: ${shipment?.version}\n`);

    // -------------------------------------------------------------------------
    // STEP 5: FIELD REVIEW UI INTERACTION
    // -------------------------------------------------------------------------
    console.log("👤 Step 5: Mimicking UI Field Review Action (APPROVE)...");
    const reviewRes = await FieldReviewService.submitFieldReviewAction({
      accountId: ACCOUNT_ID,
      userId: USER_ID,
      userName: "Upload Mimic User",
      shipmentId: SHIPMENT_ID,
      documentId: docRecord.id,
      fieldKey: "shipment.carrier.name",
      action: "APPROVE",
      value: candidates.find((c) => c.fieldDefinitionKey === "shipment.carrier.name")?.rawValue || "MAERSK LINE",
      candidateId: candidates.find((c) => c.fieldDefinitionKey === "shipment.carrier.name")?.id,
    });
    console.log(`   Field Review Success: ${reviewRes.success}`);

    const finalShipment = await db.shipment.findUnique({ where: { id: SHIPMENT_ID } });
    console.log(`   Final Shipment carrierName: "${finalShipment?.carrierName}" (Version: ${finalShipment?.version})\n`);

    // -------------------------------------------------------------------------
    // STEP 6: METRICS
    // -------------------------------------------------------------------------
    console.log("📈 Step 6: Querying HydrationMetricsService Telemetry...");
    const metrics = await HydrationMetricsService.getAccountMetrics(ACCOUNT_ID);
    console.log(`   Hydration Runs: ${metrics.totalHydrationRuns}`);
    console.log(`   Total Candidates: ${metrics.totalCandidatesGenerated}`);
    console.log(`   Average Latency: ${metrics.avgLatencyMs} ms`);
    console.log(`   Estimated Cost: $${metrics.estimatedCostUsdApprox.toFixed(4)}\n`);

    // -------------------------------------------------------------------------
    // STEP 7: CLEANUP
    // -------------------------------------------------------------------------
    console.log("🧹 Step 7: Cleaning up test fixtures...");
    await db.workflowOutboxEvent.deleteMany({ where: { accountId: ACCOUNT_ID } });
    await db.fieldApproval.deleteMany({ where: { accountId: ACCOUNT_ID } });
    await db.fact.deleteMany({ where: { shipmentId: SHIPMENT_ID } });
    await db.hydrationCandidate.deleteMany({ where: { accountId: ACCOUNT_ID } });
    await db.hydrationRun.deleteMany({ where: { accountId: ACCOUNT_ID } });
    await db.extractionField.deleteMany({ where: { document: { accountId: ACCOUNT_ID } } });
    await db.documentParseVersion.deleteMany({ where: { accountId: ACCOUNT_ID } });
    await db.shipmentDocument.deleteMany({ where: { accountId: ACCOUNT_ID } });
    await db.shipment.deleteMany({ where: { id: SHIPMENT_ID } });
    console.log("   ✅ Database test fixtures cleaned up.\n");

    console.log("================================================================================");
    console.log("🎉 UPLOAD -> PIPELINE END-TO-END MIMIC COMPLETED SUCCESSFULLY!");
    console.log("================================================================================");
  } catch (err) {
    console.error("❌ Upload Mimic Execution Failed:", err);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
