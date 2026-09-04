import type { AccountContext } from "@qubere/auth";
import { executeAssistantTool } from "./tools";

export interface AssistantEvent {
  type: "text_delta" | "tool_call" | "tool_result" | "status" | "error" | "done";
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;
  message?: string;
}

export async function* runAssistantTurn(
  accountName: string,
  turn: { message: string; history?: unknown[] },
  ctx?: AccountContext
): AsyncGenerator<AssistantEvent> {
  yield { type: "status", message: "Analyzing operational query..." };

  const msg = turn.message.toLowerCase();
  const serviceCtx = ctx;

  if (!serviceCtx?.accountId) {
    yield { type: "error", message: "Account context missing or unauthorized." };
    yield { type: "done" };
    return;
  }

  // The TMS currently has deterministic tools but no configured model-backed
  // tool-selection loop. Keep chat honest and read-oriented until a durable
  // proposal/confirmation protocol is available for state-changing tools.
  if (msg.includes("email") || msg.includes("parse email") || msg.includes("intake email")) {
    yield {
      type: "text_delta",
      text:
        "Email intake requires structured extraction evidence before it can create an order. " +
        "Use the Orders intake workspace to review the source text and confirm the extracted fields.",
    };
  }
  // Intent: Movement Stop Planning
  else if (msg.includes("plan stop") || msg.includes("movement stops") || msg.includes("plan legs")) {
    yield {
      type: "text_delta",
      text:
        "Movement planning needs a real shipment ID, route, dates, and evidence. " +
        "Open the shipment workspace to prepare and review a movement plan; no sample route was created.",
    };
  }
  // Intent: Risk Sweep
  else if (msg.includes("sweep risk") || msg.includes("run risk agent") || msg.includes("risk sweep")) {
    yield {
      type: "text_delta",
      text:
        "A risk sweep can create exceptions and update shipment health, so it is not executed from an unconfirmed chat request. " +
        "Use the operations workbench to review the scope and explicitly start the sweep.",
    };
  }
  // Intent: Freight Audit / Invoice Match
  else if (msg.includes("freight audit") || msg.includes("audit invoice") || msg.includes("audit sweep")) {
    yield {
      type: "text_delta",
      text:
        "Freight audit can change invoice and payment-approval state, so it is not executed from an unconfirmed chat request. " +
        "Use the Invoices workbench to review the invoice scope and explicitly start the audit.",
    };
  }
  // Intent: Shipments & Tracking
  else if (msg.includes("shipment") || msg.includes("status") || msg.includes("tracking") || msg.includes("at risk")) {
    const riskOnly = msg.includes("at risk") || msg.includes("critical") || msg.includes("risk");
    yield { type: "tool_call", toolName: "list_shipments", args: { riskOnly } };
    const res = (await executeAssistantTool("list_shipments", { riskOnly }, serviceCtx)) as {
      shipments?: Array<{
        shipmentNumber: string;
        mode: string;
        status: string;
        promiseState?: string;
        origin?: string;
        destination?: string;
      }>;
    };
    yield { type: "tool_result", toolName: "list_shipments", result: res };

    const items = res.shipments || [];
    let formattedText = `Here are the **${items.length} shipment(s)** matching your request:\n\n`;
    for (const s of items.slice(0, 5)) {
      formattedText += `• **${s.shipmentNumber}** (${s.mode}): **${s.status}** | Promise: \`${s.promiseState || "ON_PROMISE"}\` | Route: ${s.origin} → ${s.destination || "Dest"}\n`;
    }
    if (items.length === 0) {
      formattedText = `No active shipments found matching specified criteria.`;
    }

    yield { type: "text_delta", text: formattedText };
  }
  // Intent: Carrier Selection & Rates
  else if (msg.includes("carrier") || msg.includes("recommend") || msg.includes("rate")) {
    yield {
      type: "text_delta",
      text:
        "Carrier recommendations require a shipment ID and validated lane, equipment, insurance, safety, capacity, and rate data. " +
        "Open the shipment or tender workspace to run a grounded recommendation; no default ocean carrier was assumed.",
    };
  }
  // Intent: Exceptions
  else if (msg.includes("exception") || msg.includes("demurrage") || msg.includes("hold")) {
    yield { type: "tool_call", toolName: "list_exceptions", args: {} };
    const res = (await executeAssistantTool("list_exceptions", {}, serviceCtx)) as {
      exceptions?: Array<{
        shipmentNumber: string;
        severity: string;
        type: string;
        description: string;
        requiredAction?: string;
      }>;
    };
    yield { type: "tool_result", toolName: "list_exceptions", result: res };

    const excs = res.exceptions || [];
    let text = `### ⚠️ Active Operational Exceptions (${excs.length})\n\n`;
    if (excs.length === 0) {
      text = `No open operational exceptions. All active shipments are on track.`;
    } else {
      for (const e of excs.slice(0, 4)) {
        text += `1. **${e.shipmentNumber}** [${e.severity}]: **${e.type}** — ${e.description}\n   *Required Action*: ${e.requiredAction || "Review in Operations Inbox"}\n\n`;
      }
    }
    yield { type: "text_delta", text };
  }
  // Fallback Overview
  else {
    yield {
      type: "text_delta",
      text: `I am the **Qubere Freight Operations Assistant**.\n\n` +
            `I can summarize tenant-scoped shipment and exception data. State-changing freight actions remain policy- and permission-gated in their operational workspaces.\n\n` +
            `Try asking me:\n` +
            `• *"Sweep for LFD and customer promise risks"*\n` +
            `• *"Show shipments at risk"*\n` +
            `• *"Show active exceptions"*`,
    };
  }

  yield { type: "done" };
}
