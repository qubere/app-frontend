import { db } from "@qubere/db";
import { executeTmsPipelineJob, enqueueTmsDocumentPipeline } from "../apps/tms/src/lib/tmsPipelineEngine";
import { randomUUID } from "node:crypto";

async function main() {
  const document = await db.shipmentDocument.findFirst({
    where: { shipmentId: { not: null } },
    orderBy: { createdAt: "desc" },
  });

  if (!document || !document.shipmentId) {
    console.log("No attached document found.");
    process.exit(0);
  }

  const user = await db.user.findFirst();
  const userId = user?.id ?? "usr_demo";

  console.log("Re-processing document:", document.id, document.fileName, "for shipment:", document.shipmentId);

  const runKey = randomUUID();
  const job = await enqueueTmsDocumentPipeline({
    accountId: document.accountId,
    userId,
    shipmentId: document.shipmentId,
    documentId: document.id,
    correlationId: runKey,
    runKey,
    forceExtraction: true,
  });

  console.log("Enqueued new pipeline job:", job.id);
  const result = await executeTmsPipelineJob(job.id);
  console.log("Job completion status:", result?.status);
  
  const stepExecutions = await db.pipelineStepExecution.findMany({
    where: { jobId: job.id },
    orderBy: { stepNumber: "asc" },
  });

  for (const step of stepExecutions) {
    console.log(`Step ${step.stepNumber} [${step.agentName}]: ${step.status} - Output: ${step.output}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
