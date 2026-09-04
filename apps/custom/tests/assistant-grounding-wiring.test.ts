import { describe, it, expect, vi, afterEach } from "vitest";
import type { AccountContext } from "@/lib/auth";

// The orchestrator streams the model's text to the user token by token, then
// runs the grounding ledger and — if it changed anything — emits `text_replace`.
// This test proves that wiring end to end: a model that invents a shipment
// number with no tool call to back it must produce a `text_replace` carrying
// the "[Unverified Shipment]" annotation.

vi.mock("@/modules/assistant/shared/audit", () => ({
  auditConversationStarted: vi.fn().mockResolvedValue(undefined),
  auditError: vi.fn().mockResolvedValue(undefined),
  auditQuery: vi.fn().mockResolvedValue(undefined),
  auditToolExecuted: vi.fn().mockResolvedValue(undefined),
}));

// Mutated per test; the mocked Anthropic client streams whatever this holds.
let modelText = "";

function fakeAnthropicStream(text: string) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text } };
    },
    finalMessage: async () => ({
      content: [{ type: "text", text }],
      usage: { input_tokens: 5, output_tokens: 5 },
    }),
  };
}

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: () => fakeAnthropicStream(modelText) };
  },
}));

import { runAssistantTurn } from "@/modules/assistant/orchestrator";

const ctx = {
  accountId: "acc-1",
  userId: "usr-1",
  roleNames: ["OWNER"],
  permissions: ["ai.use"],
} as unknown as AccountContext;

async function collect(message: string, requestId: string): Promise<Array<Record<string, unknown>>> {
  const events: Array<Record<string, unknown>> = [];
  for await (const ev of runAssistantTurn(ctx, { message, history: [], requestId })) {
    events.push(ev as Record<string, unknown>);
  }
  return events;
}

describe("orchestrator grounding wiring", () => {
  const origAnthropic = process.env.ANTHROPIC_API_KEY;
  const origGemini = process.env.GEMINI_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = origAnthropic;
    process.env.GEMINI_API_KEY = origGemini;
  });

  it("emits text_replace annotating an ungrounded shipment citation", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.GEMINI_API_KEY;
    modelText = "The relevant record is shipment SHP-2099-000001.";

    const events = await collect("Which shipment is affected?", "req-ground-1");

    const streamed = events.filter((e) => e.type === "text").map((e) => e.delta).join("");
    expect(streamed).toBe(modelText);

    const replace = events.find((e) => e.type === "text_replace");
    expect(replace, "expected a text_replace event").toBeDefined();
    expect(replace!.text).toContain("SHP-2099-000001 [Unverified Shipment]");

    const replaceIdx = events.findIndex((e) => e.type === "text_replace");
    const doneIdx = events.findIndex((e) => e.type === "done");
    expect(doneIdx).toBeGreaterThan(replaceIdx);
  });

  it("does not emit text_replace when there is nothing to annotate", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.GEMINI_API_KEY;
    modelText = "There is no shipment on record for that reference.";

    const events = await collect("Any shipment?", "req-ground-2");

    expect(events.some((e) => e.type === "text_replace")).toBe(false);
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});
