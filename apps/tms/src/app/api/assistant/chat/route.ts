import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@qubere/auth";
import { runAssistantTurn } from "@/modules/assistant/orchestrator";

export const POST = withAuthenticatedRoute(
  async ({ req, ctx }: any) => {
    try {
      const body = await req.json().catch(() => ({}));
      const message = body?.message || "";

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const event of runAssistantTurn(ctx.accountName || "Freight Workspace", { message, history: body?.history || [] }, ctx)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Error running turn";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        },
      });
    } catch {
      return NextResponse.json({ error: "Failed to process message" }, { status: 500 });
    }
  },
  { permission: "tms.access" }
);
