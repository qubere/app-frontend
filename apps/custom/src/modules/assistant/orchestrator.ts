import { getGeminiClient } from "@/lib/ai/geminiClient";
import type { Content, Part } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import type { AccountContext } from "@/lib/auth";
import { availableAssistantTools } from "./tools";
import { aiModel } from "@/lib/ai/aiModel";
import { meterGeminiCall } from "@/lib/ai/aiMeter";
import {
  auditConversationStarted,
  auditError,
  auditQuery,
  auditToolExecuted,
} from "@/modules/assistant/shared/audit";
import type { CopilotStatus } from "@/modules/assistant/shared/contract";
import { buildCopilotSystemPrompt, COPILOT_PROMPT_VERSION } from "@/modules/assistant/shared/prompts/systemPrompt";
import { CopilotGroundingLedger } from "@/modules/assistant/shared/copilotLedger";

const aiClient = getGeminiClient();
const CHAT_SURFACE = "copilot" as const;
export { COPILOT_PROMPT_VERSION };
export const ASSISTANT_PROMPT_VERSION = COPILOT_PROMPT_VERSION;

export interface ChatTurnInput {
  message: string;
  history: Content[];
  requestId: string;
}

export type AssistantStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "error"; message: string }
  | { type: "history"; turns: Content[] }
  | { type: "done" };

const MAX_TOOL_ROUNDS = 6;

function toolResultFailed(output: unknown): boolean {
  return Boolean(output && typeof output === "object" && "error" in (output as Record<string, unknown>));
}

export async function* runAssistantTurn(
  ctx: AccountContext,
  input: ChatTurnInput
): AsyncGenerator<AssistantStreamEvent> {
  const subject = {
    accountId: ctx.accountId,
    userId: ctx.userId,
    requestId: input.requestId,
    conversationId: input.requestId,
  };
  const startedAt = Date.now();

  const useAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  const useGemini = Boolean(process.env.GEMINI_API_KEY);

  if (!useAnthropic && !useGemini) {
    await auditError(subject, { stage: "config", reason: "model_not_configured" });
    yield { type: "error", message: "The assistant isn't configured yet (ANTHROPIC_API_KEY or GEMINI_API_KEY is missing)." };
    return;
  }

  if (input.history.length === 0) {
    await auditConversationStarted(subject, {
      pageContext: "CHAT",
      entityType: null,
      entityId: null,
    });
  }

  const tools = availableAssistantTools(ctx);
  const toolsByName = new Map(tools.map((t) => [t.declaration.name, t]));
  let toolCallsMade = 0;
  let modelCalls = 0;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  const groundingLedger = new CopilotGroundingLedger();
  let fullText = "";

  const today = new Date().toISOString().split("T")[0];
  const systemPrompt = buildCopilotSystemPrompt({ resolvedContext: null, today });

  const providerName = useAnthropic ? "anthropic" : "google-genai";
  const model = useAnthropic
    ? (process.env.COPILOT_MODEL || process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219")
    : aiModel(CHAT_SURFACE);

  const finish = async (status: CopilotStatus, round: number) => {
    const { entitiesCited, evidenceCited, droppedCitations } = groundingLedger.validate(fullText);
    await auditQuery(subject, {
      question: input.message,
      status,
      durationMs: Date.now() - startedAt,
      toolCallsMade,
      iterations: round + 1,
      entitiesCited,
      evidenceCited,
      actionsOffered: 0,
      droppedCitations,
      model,
      provider: providerName,
      historyTurnsUsed: input.history.length,
      modelCalls,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens === null && outputTokens === null ? null : (inputTokens ?? 0) + (outputTokens ?? 0),
    });
  };

  if (useAnthropic) {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const anthropicTools: Anthropic.Tool[] = tools.filter((t) => t.declaration.name != null).map((t) => ({
      name: t.declaration.name!,
      description: t.declaration.description ?? "",
      input_schema: {
        type: "object" as const,
        properties: (t.declaration.parameters?.properties as Record<string, unknown>) ?? {},
        required: (t.declaration.parameters?.required as string[]) ?? [],
      },
    }));

    const messages: Anthropic.MessageParam[] = [];
    for (const h of input.history) {
      const textPart = (h.parts ?? []).map((p) => p.text ?? "").join("\n").trim();
      if (!textPart) continue;
      messages.push({
        role: h.role === "model" ? "assistant" : "user",
        content: textPart,
      });
    }
    messages.push({ role: "user", content: input.message });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let stream;
      try {
        stream = anthropic.messages.stream({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          tools: anthropicTools,
          messages,
        });
      } catch (err) {
        await auditError(subject, { stage: "model_call", reason: "provider_call_failed" });
        yield { type: "error", message: err instanceof Error ? err.message : "Failed to reach Anthropic model." };
        return;
      }

      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          fullText += chunk.delta.text;
          yield { type: "text", delta: chunk.delta.text };
        }
      }

      const responseMessage = await stream.finalMessage();
      modelCalls += 1;
      if (responseMessage.usage) {
        inputTokens = (inputTokens ?? 0) + responseMessage.usage.input_tokens;
        outputTokens = (outputTokens ?? 0) + responseMessage.usage.output_tokens;
      }

      const toolCalls = responseMessage.content.filter((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
      messages.push({ role: "assistant", content: responseMessage.content });

      if (toolCalls.length === 0) {
        yield { type: "done" };
        await finish("ANSWERED", round);
        return;
      }

      const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
      for (const call of toolCalls) {
        const name = call.name;
        yield { type: "tool_call", name };

        const toolStartedAt = Date.now();
        let output: unknown;
        const tool = toolsByName.get(name);
        try {
          output = tool
            ? await tool.execute(ctx, (call.input as Record<string, unknown>) ?? {})
            : { error: `Unknown tool: ${name}` };
        } catch (err) {
          output = { error: err instanceof Error ? err.message : "Tool execution failed" };
        }
        toolCallsMade += 1;
        groundingLedger.recordToolOutput(output);

        await auditToolExecuted(subject, {
          tool: name,
          ok: !toolResultFailed(output),
          code: toolResultFailed(output) ? "UNAVAILABLE" : null,
          durationMs: Date.now() - toolStartedAt,
          cached: false,
        });

        yield { type: "tool_result", name, result: output };
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: JSON.stringify(output),
        });
      }

      messages.push({ role: "user", content: toolResultBlocks });
    }

    await finish("PARTIAL", MAX_TOOL_ROUNDS - 1);
    yield { type: "error", message: "Stopped after too many tool calls in a single turn." };
    return;
  }

  // Fallback to Gemini
  const chat = aiClient.chats.create({
    model,
    history: input.history,
    config: {
      systemInstruction: systemPrompt,
      tools: [{ functionDeclarations: tools.map((t) => t.declaration) }],
      temperature: 0.2,
    },
  });

  let nextMessage: string | Part[] = input.message;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let stream: AsyncGenerator<{
      text?: string;
      functionCalls?: { name?: string; args?: Record<string, unknown> }[];
      usageMetadata?: unknown;
    }>;
    try {
      stream = await chat.sendMessageStream({ message: nextMessage });
    } catch (err) {
      await auditError(subject, { stage: "model_call", reason: "provider_call_failed" });
      yield { type: "error", message: err instanceof Error ? err.message : "Failed to reach the model." };
      return;
    }

    let sawFunctionCall = false;
    let lastUsage: unknown = null;
    const functionResponseParts: Part[] = [];

    for await (const chunk of stream) {
      if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
      if (chunk.text) {
        fullText += chunk.text;
        yield { type: "text", delta: chunk.text };
      }

      const calls = chunk.functionCalls;
      if (calls && calls.length > 0) {
        sawFunctionCall = true;
        for (const call of calls) {
          const name = call.name ?? "unknown";
          yield { type: "tool_call", name };

          const toolStartedAt = Date.now();
          let output: unknown;
          const tool = toolsByName.get(name);
          try {
            output = tool
              ? await tool.execute(ctx, call.args ?? {})
              : { error: `Unknown tool: ${name}` };
          } catch (err) {
            output = { error: err instanceof Error ? err.message : "Tool execution failed" };
          }
          toolCallsMade += 1;
          groundingLedger.recordToolOutput(output);
          await auditToolExecuted(subject, {
            tool: name,
            ok: !toolResultFailed(output),
            code: toolResultFailed(output) ? "UNAVAILABLE" : null,
            durationMs: Date.now() - toolStartedAt,
            cached: false,
          });

          yield { type: "tool_result", name, result: output };
          functionResponseParts.push({
            functionResponse: { name, response: { output } },
          });
        }
      }
    }

    modelCalls += 1;
    if (lastUsage) {
      await meterGeminiCall(CHAT_SURFACE, { accountId: ctx.accountId, userId: ctx.userId }, { usageMetadata: lastUsage });
      const usage = lastUsage as { promptTokenCount?: unknown; candidatesTokenCount?: unknown };
      if (typeof usage.promptTokenCount === "number") inputTokens = (inputTokens ?? 0) + usage.promptTokenCount;
      if (typeof usage.candidatesTokenCount === "number") outputTokens = (outputTokens ?? 0) + usage.candidatesTokenCount;
    }

    if (!sawFunctionCall) {
      yield { type: "history", turns: chat.getHistory() };
      await finish("ANSWERED", round);
      yield { type: "done" };
      return;
    }
    nextMessage = functionResponseParts;
  }

  yield { type: "history", turns: chat.getHistory() };
  await finish("PARTIAL", MAX_TOOL_ROUNDS - 1);
  yield { type: "error", message: "Stopped after too many tool calls in a single turn." };
}
