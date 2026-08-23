import { type DocumentIntakeAgentOutput, type AppOrigin } from "./documentIntakeAgent";
import { logAgentError } from "@/modules/agents/agentLogger";

export interface PostIntakeRoutingInput {
  intakeOutput: DocumentIntakeAgentOutput;
  accountId: string;
  userId: string;
  shipmentId: string;
  documentId?: string;
}

export async function dispatchPostIntakeProcessing(input: PostIntakeRoutingInput): Promise<{
  routedTo: string;
  success: boolean;
  message: string;
}> {
  const { intakeOutput, accountId, userId, shipmentId, documentId } = input;
  const sourceApp: AppOrigin = intakeOutput.sourceApp || "CUSTOMS";

  console.log(
    `[IntakePipelineRouter] Routing classified packet ${intakeOutput.packetId} from sourceApp: '${sourceApp}' for shipment: ${shipmentId}`
  );

  try {
    if (sourceApp === "TMS" || sourceApp === "MOVE") {
      // Dispatch to TMS Shipment Enrichment / Freight Extraction Engine
      console.log(`[IntakePipelineRouter] -> Dispatching to TMS Freight Extraction Engine for document ${documentId || "N/A"}`);
      
      // Dynamic import to keep domain engines decoupled
      let extractFreightDocument: any = null;
      try {
        const mod = await import("../../../tms/src/modules/documents/services/documentFreightExtraction" as any);
        extractFreightDocument = mod.extractFreightDocument;
      } catch {
        // Safe fallback
      }

      if (extractFreightDocument && intakeOutput.fileName && intakeOutput.fileUrl) {
        await extractFreightDocument({
          fileName: intakeOutput.fileName,
          fileUrl: intakeOutput.fileUrl,
          mimeType: intakeOutput.mimeType || null,
        });
      }

      return {
        routedTo: "TMS_SHIPMENT_ENRICHMENT",
        success: true,
        message: `Successfully routed packet ${intakeOutput.packetId} to TMS Shipment Enrichment Agent.`,
      };
    }

    // Default: Customs / Clear Domain Routing
    console.log(`[IntakePipelineRouter] -> Dispatching to Customs Document Intelligence Agent for document ${documentId || "N/A"}`);
    
    const { DocumentIntelligenceAgent } = await import("@/modules/agents/documentIntelligenceAgent").catch(() => ({
      DocumentIntelligenceAgent: null,
    }));

    if (DocumentIntelligenceAgent && documentId) {
      await DocumentIntelligenceAgent.execute({
        accountId,
        userId,
        shipmentId,
        documentId,
        packetId: intakeOutput.packetId,
      });
    }

    return {
      routedTo: "CUSTOMS_DOCUMENT_INTELLIGENCE",
      success: true,
      message: `Successfully routed packet ${intakeOutput.packetId} to Customs Document Intelligence Agent.`,
    };
  } catch (err: any) {
    logAgentError("IntakePipelineRouter", shipmentId, "dispatchPostIntakeProcessing", err);
    return {
      routedTo: sourceApp,
      success: false,
      message: `Routing failed: ${err.message || "Unknown error"}`,
    };
  }
}
