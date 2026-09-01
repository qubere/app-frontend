"use client";

import type { Content } from "@google/genai";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  LoaderCircle,
  MessageCircle,
  Scale,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpGuideLink {
  id: string;
  question: string;
  href: string | null;
  actionLabel: string | null;
}

interface SupportMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
  guides?: HelpGuideLink[];
}

const INITIAL_MESSAGES: SupportMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "Tell me what you’re trying to do in Qubere. I’ll search the current product guides and give you the shortest safe path.",
  },
];

function guideLinks(result: unknown): HelpGuideLink[] {
  if (!result || typeof result !== "object") return [];
  const guides = (result as { guides?: unknown }).guides;
  if (!Array.isArray(guides)) return [];
  return guides
    .filter((guide): guide is Record<string, unknown> => Boolean(guide && typeof guide === "object"))
    .map((guide) => ({
      id: String(guide.id ?? ""),
      question: String(guide.question ?? "Open guide"),
      href: typeof guide.href === "string" ? guide.href : null,
      actionLabel: typeof guide.actionLabel === "string" ? guide.actionLabel : null,
    }))
    .filter((guide) => guide.id);
}

export function SupportAgent() {
  const [messages, setMessages] = useState<SupportMessage[]>(INITIAL_MESSAGES);
  const [history, setHistory] = useState<Content[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const nextIdRef = useRef(2);
  const conversationRef = useRef<HTMLDivElement>(null);

  function scrollConversation() {
    requestAnimationFrame(() => {
      conversationRef.current?.scrollTo({
        top: conversationRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  async function sendMessage(text: string) {
    const cleanText = text.trim();
    if (!cleanText || sending) return;

    const userId = nextIdRef.current++;
    const assistantId = nextIdRef.current++;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text: cleanText },
      { id: assistantId, role: "assistant", text: "" },
    ]);
    setInput("");
    setSending(true);
    scrollConversation();

    let assistantText = "";
    let links: HelpGuideLink[] = [];
    let nextHistory = history;
    const updateAssistant = () => {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, text: assistantText, guides: links }
            : message
        )
      );
      scrollConversation();
    };

    const applyEvent = (event: Record<string, unknown>) => {
      if (event.type === "text") {
        assistantText += String(event.delta ?? "");
      } else if (event.type === "text_replace") {
        assistantText = String(event.text ?? "");
      } else if (event.type === "tool_result" && event.name === "search_product_help") {
        links = guideLinks(event.result);
      } else if (event.type === "history" && Array.isArray(event.turns)) {
        nextHistory = event.turns as Content[];
      } else if (event.type === "error" && !assistantText) {
        assistantText = String(event.message ?? "I couldn’t complete that help search.");
      }
      updateAssistant();
    };

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: cleanText, history, surface: "support" }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? `Request failed (${response.status})`);
      }
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const applyFrame = (frame: string) => {
        const line = frame.split("\n").find((item) => item.startsWith("data:"));
        if (line) applyEvent(JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        frames.filter((frame) => frame.trim()).forEach(applyFrame);
      }
      if (buffer.trim()) applyFrame(buffer);
      setHistory(nextHistory);
    } catch (error) {
      assistantText =
        error instanceof Error
          ? `I couldn’t reach AI Support: ${error.message}`
          : "I couldn’t reach AI Support.";
      updateAssistant();
    } finally {
      setSending(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <aside className="xl:sticky xl:top-6" aria-label="Qubere AI Support">
      <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-[0_18px_50px_-25px_rgba(0,45,90,0.35)]">
        <div className="relative overflow-hidden border-b border-blue-100 bg-gradient-to-br from-[#F0F7FF] via-white to-[#F7F5FF] p-5">
          <div className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-brand/10 blur-2xl" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-white shadow-sm shadow-brand/20">
                <Bot className="h-5 w-5" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-ink">AI Support</h2>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700">
                    Live
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">Grounded in Qubere product help</p>
              </div>
            </div>
            <Sparkles className="h-4 w-4 text-brand" />
          </div>
        </div>

        <div className="border-b border-blue-100 bg-blue-50/70 px-5 py-3">
          <p className="text-[10px] leading-4 text-blue-800">
            This embedded agent can search and explain product workflows. It cannot change account data or complete actions.
          </p>
        </div>

        <div ref={conversationRef} className="h-96 space-y-4 overflow-y-auto px-4 py-5" aria-live="polite">
          {messages.map((message) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div className="max-w-[90%] space-y-2">
                <div
                  className={cn(
                    "whitespace-pre-wrap rounded-2xl px-3.5 py-3 text-xs leading-5",
                    message.role === "user"
                      ? "rounded-br-md bg-brand text-white"
                      : "rounded-bl-md border border-border bg-surface-muted text-ink"
                  )}
                >
                  {message.text || (sending && message.role === "assistant" ? (
                    <span className="inline-flex items-center gap-2 text-ink-muted">
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Searching product help…
                    </span>
                  ) : null)}
                </div>
                {message.guides?.map((guide) =>
                  guide.href ? (
                    <Link
                      key={guide.id}
                      href={guide.href}
                      className="flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-brand hover:border-brand/30"
                    >
                      <span className="line-clamp-2">{guide.actionLabel ?? guide.question}</span>
                      <ArrowRight className="h-3 w-3 shrink-0" />
                    </Link>
                  ) : null
                )}
              </div>
            </div>
          ))}

          {messages.length === 1 && (
            <div className="space-y-2 pt-1">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Try asking</p>
              {["Why is my filing not ready?", "How do I attach an invoice?", "How do I review a party hit?"].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-2.5 text-left text-xs font-medium text-ink transition hover:border-brand/30 hover:bg-blue-50 hover:text-brand"
                >
                  {prompt}
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface-muted p-2 focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/10">
            <label htmlFor="support-agent-input" className="sr-only">Ask AI Support</label>
            <textarea
              id="support-agent-input"
              rows={1}
              value={input}
              disabled={sending}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Ask how to do something…"
              className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-xs leading-5 text-ink outline-none placeholder:text-ink-muted disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send support question"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Link href="/chat" className="mt-2 flex items-center justify-center gap-1 text-[9px] font-semibold text-brand hover:underline">
            Open full Ask Qubere for account questions <ArrowRight className="h-2.5 w-2.5" />
          </Link>
        </form>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-white p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand">
            <Scale className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-ink">Regulated decisions still need review</h3>
            <p className="mt-1 text-[10px] leading-4 text-ink-muted">
              Product guidance does not replace a licensed broker’s classification, valuation, origin, admissibility, or filing judgment.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
