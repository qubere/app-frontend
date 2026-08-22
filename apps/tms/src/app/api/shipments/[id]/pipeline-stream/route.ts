import { withAuthenticatedRoute } from "@qubere/auth";
import { getTmsPipelineStatus } from "@/lib/tmsPipelineEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = withAuthenticatedRoute<{ id: string }>(
  async ({ req, ctx, params }) => {
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let lastPayload = "";

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const close = () => {
          if (closed) return;
          closed = true;
          if (timer) clearTimeout(timer);
          try { controller.close(); } catch { /* stream already closed */ }
        };
        req.signal.addEventListener("abort", close, { once: true });
        timer = setTimeout(close, 55_000);

        const send = async () => {
          if (closed) return;
          try {
            const status = await getTmsPipelineStatus(ctx.accountId, params.id);
            const payload = JSON.stringify(status);
            if (payload !== lastPayload) {
              lastPayload = payload;
              controller.enqueue(encoder.encode(`retry: 1500\ndata: ${payload}\n\n`));
            } else {
              controller.enqueue(encoder.encode(": keep-alive\n\n"));
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Pipeline status is unavailable.";
            controller.enqueue(encoder.encode(`event: pipeline-error\ndata: ${JSON.stringify({ error: message })}\n\n`));
          }
          if (!closed) setTimeout(send, 1500);
        };
        void send();
      },
      cancel() {
        closed = true;
        if (timer) clearTimeout(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
  { permission: "shipments.read" }
);
