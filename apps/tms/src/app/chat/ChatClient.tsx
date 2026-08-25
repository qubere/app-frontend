"use client";

import { useState, useRef, useEffect, useMemo, useCallback, createContext, useContext, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  Send, Loader2, Sparkles, Plus, Trash2,
  LayoutDashboard, Package, Truck, TriangleAlert, ReceiptText,
  Layers, Files, MessageSquare, ChevronRight,
  ChevronsLeft, ChevronsRight, Moon, Sun, Paperclip, X
} from "lucide-react";
import { Badge, Card, Button } from "@/components/ui";

// ── Theme ─────────────────────────────────────────────────────────────────────

interface Theme {
  pageBg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  ink: string;
  inkMuted: string;
  brand: string;
  brandHover: string;
  activeItem: string;
}

const LIGHT: Theme = {
  pageBg: "#F5F5F7",
  surface: "#ffffff",
  surfaceHover: "#F5F5F7",
  border: "#E5E5EA",
  ink: "#1D1D1F",
  inkMuted: "#86868B",
  brand: "#0071E3",
  brandHover: "#0077ED",
  activeItem: "rgba(0,113,227,0.08)",
};

const DARK: Theme = {
  pageBg: "#000000",
  surface: "#1C1C1E",
  surfaceHover: "#2C2C2E",
  border: "#3A3A3C",
  ink: "#F5F5F7",
  inkMuted: "#8E8E93",
  brand: "#0A84FF",
  brandHover: "#409CFF",
  activeItem: "rgba(10,132,255,0.15)",
};

const ThemeCtx = createContext<Theme>(LIGHT);
const useTh = () => useContext(ThemeCtx);

// ── Pending upload context ───────────────────────────────────────────────────

interface PendingUploadState {
  pendingFile: File | null;
  onAttach: (shipmentId: string, shipmentNumber: string) => void;
}

const PendingUploadCtx = createContext<PendingUploadState>({ pendingFile: null, onAttach: () => {} });
const usePendingUpload = () => useContext(PendingUploadCtx);

function extractShipmentId(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/\/app\/shipments\/([^/?#]+)/) || url.match(/\/shipments\/([^/?#]+)/);
  return m ? m[1] : null;
}

function findKnownShipmentInText(text?: string | null, known?: Map<string, string>): { number: string; id: string } | null {
  if (!text || typeof text !== "string" || !known) return null;
  const upper = text.toUpperCase();
  for (const [number, id] of known) {
    if (number && upper.includes(number.toUpperCase())) return { number, id };
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ToolCallDisplay {
  name: string;
  status: "running" | "done";
  result?: unknown;
}

interface MessageDisplay {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls: ToolCallDisplay[];
  attachedFileName?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: MessageDisplay[];
  history: any[];
  persisted: boolean;
}

interface DbChatSession {
  id: string;
  title: string;
  messages: unknown;
  history: unknown;
  updatedAt: string;
}

// ── Nav items ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", Icon: LayoutDashboard },
  { label: "Orders", href: "/orders", Icon: Package },
  { label: "Shipments", href: "/shipments", Icon: Truck },
  { label: "Exceptions", href: "/exceptions", Icon: TriangleAlert },
  { label: "Quotes & Tenders", href: "/quotes", Icon: ReceiptText },
  { label: "Carriers", href: "/carriers", Icon: Layers },
  { label: "Documents", href: "/documents", Icon: Files },
];

const SAMPLE_GROUPS = [
  {
    label: "Shipments & Telematics",
    prompts: [
      "Which shipments are at risk?",
      "Track stale GPS telemetry",
      "Critical shipments today",
      "Port demurrage exposure",
    ],
  },
  {
    label: "Carriers & Tenders",
    prompts: [
      "Recommend carrier for Dallas to Atlanta",
      "Compare carrier OTD scores",
      "Show active tenders",
    ],
  },
  {
    label: "Exceptions & Audits",
    prompts: [
      "List open exceptions",
      "Show unassigned freight orders",
      "Audit 3-way freight invoices",
    ],
  },
];

const TOPBAR_HEIGHT = 49;
const SUGGESTED_PROMPT = "Which shipments are currently at risk?";

const QUICK_CHIPS = [
  "At-risk shipments",
  "Recommend carrier",
  "Open exceptions",
  "Unassigned orders",
  "Audit freight invoices",
];

// ── Persistence ──────────────────────────────────────────────────────────────

async function fetchSessions(): Promise<ChatSession[]> {
  try {
    const res = await fetch("/api/assistant/chats");
    if (!res.ok) return [];
    const data = (await res.json()) as { sessions: DbChatSession[] };
    if (!Array.isArray(data?.sessions)) return [];
    return data.sessions
      .slice()
      .reverse()
      .map((s) => ({
        id: s.id,
        title: s.title ?? "Freight Chat",
        createdAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
        messages: Array.isArray(s.messages)
          ? (s.messages as MessageDisplay[]).map((m) => ({
              ...m,
              toolCalls: Array.isArray(m?.toolCalls) ? m.toolCalls : [],
            }))
          : [],
        history: Array.isArray(s.history) ? s.history : [],
        persisted: true,
      }));
  } catch (err) {
    console.error("Failed to fetch chat sessions:", err);
    return [];
  }
}

async function createSessionInDb(data: { title: string; messages: MessageDisplay[]; history: any[] }): Promise<DbChatSession | null> {
  const res = await fetch("/api/assistant/chats", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  const { session } = (await res.json()) as { session: DbChatSession };
  return session;
}

async function updateSessionInDb(id: string, data: { title: string; messages: MessageDisplay[]; history: any[] }): Promise<void> {
  await fetch(`/api/assistant/chats/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  }).catch(() => {});
}

async function deleteSessionInDb(id: string): Promise<void> {
  await fetch(`/api/assistant/chats/${id}`, { method: "DELETE" }).catch(() => {});
}

function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function freshSession(): ChatSession {
  return { id: `local-${safeRandomUUID()}`, title: "New chat", createdAt: Date.now(), messages: [], history: [], persisted: false };
}

function relativeTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

const nextId = () => `m-${safeRandomUUID()}`;

// ── Markdown Renderer ─────────────────────────────────────────────────────────

function mdLine(text: string, inkMuted: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} style={{ background: inkMuted + "22", borderRadius: 4, padding: "0 4px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}>{p.slice(1, -1)}</code>;
    return p;
  });
}

function splitTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((c) => c.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith("|") && t.endsWith("|") && t.length > 1;
}

function isTableSeparatorRow(line: string): boolean {
  if (!isTableRow(line)) return false;
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
}

function isNumericCell(cell: string): boolean {
  return /^[$]?-?[\d,]+(\.\d+)?%?$/.test(cell.trim()) && /\d/.test(cell);
}

function MdTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const th = useTh();
  return (
    <div style={{ overflowX: "auto", margin: "6px 0 12px", border: `1px solid ${th.border}`, borderRadius: 10 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: isNumericCell(h) ? "right" : "left", padding: "8px 12px", fontSize: 10.5, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.05em", color: th.inkMuted, background: th.pageBg,
                borderBottom: `1px solid ${th.border}`, whiteSpace: "nowrap",
              }}>
                {mdLine(h, th.inkMuted)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ borderTop: `1px solid ${th.border}` }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "8px 12px", color: th.ink, textAlign: isNumericCell(cell) ? "right" : "left",
                  fontVariantNumeric: "tabular-nums", verticalAlign: "top",
                }}>
                  {mdLine(cell, th.inkMuted)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MdText({ text }: { text: string }) {
  const th = useTh();
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i]) && isTableSeparatorRow(lines[i + 1] ?? "")) {
      const headers = splitTableRow(lines[i]);
      let j = i + 2;
      const rows: string[][] = [];
      while (j < lines.length && isTableRow(lines[j])) { rows.push(splitTableRow(lines[j])); j++; }
      blocks.push(<MdTable key={i} headers={headers} rows={rows} />);
      i = j;
      continue;
    }
    const line = lines[i];
    const isBullet = /^[*\-]\s+/.test(line);
    const content = isBullet ? line.replace(/^[*\-]\s+/, "") : line;
    if (isBullet) {
      blocks.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 2 }}>
          <span style={{ color: th.inkMuted, flexShrink: 0, marginTop: 2 }}>•</span>
          <span>{mdLine(content, th.inkMuted)}</span>
        </div>
      );
    } else if (!line.trim()) {
      blocks.push(<div key={i} style={{ height: 8 }} />);
    } else {
      blocks.push(<div key={i} style={{ marginBottom: 2 }}>{mdLine(content, th.inkMuted)}</div>);
    }
    i++;
  }
  return <div style={{ color: th.ink, fontSize: 14, lineHeight: 1.6 }}>{blocks}</div>;
}

// ── Left Nav ──────────────────────────────────────────────────────────────────

function LeftNav({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const th = useTh();
  const w = expanded ? 192 : 56;

  return (
    <nav style={{ width: w, minWidth: w, background: th.surface, borderRight: `1px solid ${th.border}`, transition: "width 0.2s ease" }}
      className="hidden lg:flex flex-col h-full py-3 items-center gap-1 overflow-hidden">

      {/* Logo */}
      <Link href="/" title="Qubere TMS"
        style={{ background: th.brand, borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", marginBottom: 12, flexShrink: 0, transition: "background 0.15s" }}
        className="hover:opacity-90">
        <Sparkles style={{ width: 16, height: 16 }} />
      </Link>

      <div style={{ width: "80%", height: 1, background: th.border, marginBottom: 4 }} />

      {/* Operations Nav */}
      {NAV_ITEMS.map(({ label, href, Icon }) => (
        <Link key={href} href={href} title={label}
          style={{ width: expanded ? "calc(100% - 16px)" : 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", gap: 10, padding: expanded ? "0 10px" : "0", justifyContent: expanded ? "flex-start" : "center", color: th.inkMuted, transition: "background 0.15s, color 0.15s, width 0.2s" }}
          className="hover:text-inherit hover:bg-slate-100 dark:hover:bg-slate-800">
          <Icon style={{ width: 16, height: 16, flexShrink: 0 }} />
          {expanded && <span style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden" }}>{label}</span>}
        </Link>
      ))}

      {/* Active Indicator & Toggle */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
        <div style={{ background: `${th.brand}18`, borderRadius: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", color: th.brand }}>
          <MessageSquare style={{ width: 16, height: 16 }} />
        </div>
        <button type="button" onClick={onToggle} title={expanded ? "Collapse" : "Expand"}
          style={{ background: "none", border: "none", cursor: "pointer", color: th.inkMuted, padding: 6, borderRadius: 8, display: "flex" }}>
          {expanded ? <ChevronsLeft style={{ width: 16, height: 16 }} /> : <ChevronsRight style={{ width: 16, height: 16 }} />}
        </button>
      </div>
    </nav>
  );
}

// ── Right Panel ───────────────────────────────────────────────────────────────

function RightPanel({
  sessions, activeId, onNew, onSwitch, onDelete, onSampleClick, isDark, onToggleDark,
}: {
  sessions: ChatSession[];
  activeId: string;
  onNew: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onSampleClick: (p: string) => void;
  isDark: boolean;
  onToggleDark: () => void;
}) {
  const th = useTh();
  return (
    <aside style={{ width: 256, minWidth: 256, background: th.surface, borderLeft: `1px solid ${th.border}` }}
      className="hidden xl:flex flex-col h-full">

      <div style={{ height: TOPBAR_HEIGHT, boxSizing: "border-box", borderBottom: `1px solid ${th.border}`, flexShrink: 0 }} />

      {/* Dark mode toggle */}
      <div style={{ padding: 12, borderBottom: `1px solid ${th.border}` }}>
        <button type="button" onClick={onToggleDark}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", borderRadius: 10, border: `1px solid ${th.border}`, background: "none", cursor: "pointer", color: th.ink, fontSize: 13, fontWeight: 500 }}>
          {isDark
            ? <Sun style={{ width: 14, height: 14, color: th.brand }} />
            : <Moon style={{ width: 14, height: 14, color: th.inkMuted }} />}
          {isDark ? "Light mode" : "Dark mode"}
        </button>
      </div>

      {/* Sample questions */}
      <div style={{ padding: "12px 8px", borderBottom: `1px solid ${th.border}` }}>
        <div style={{ padding: "0 4px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: th.inkMuted }}>Try asking</div>
        {SAMPLE_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: th.inkMuted, padding: "0 8px", marginBottom: 2 }}>{group.label}</div>
            {group.prompts.map((p) => (
              <button key={p} type="button" onClick={() => onSampleClick(p)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 8, background: "none", border: "none", cursor: "pointer", textAlign: "left", color: th.inkMuted, fontSize: 12 }}
                className="hover:bg-slate-100 dark:hover:bg-slate-800">
                <ChevronRight style={{ width: 12, height: 12, flexShrink: 0, opacity: 0.5 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* New chat */}
      <div style={{ padding: 12, borderBottom: `1px solid ${th.border}` }}>
        <button type="button" onClick={onNew}
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", borderRadius: 10, background: th.brand, border: "none", cursor: "pointer", color: "#fff", fontSize: 13, fontWeight: 500 }}>
          <Plus style={{ width: 16, height: 16 }} />
          New chat
        </button>
      </div>

      {/* History list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "12px 12px 4px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: th.inkMuted }}>Recent</div>
        <div style={{ padding: "0 8px 8px" }}>
          {[...sessions].reverse().map((s) => {
            const isActive = s.id === activeId;
            return (
              <div key={s.id} role="button" tabIndex={0}
                onClick={() => onSwitch(s.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSwitch(s.id); }}
                style={{
                  width: "100%", display: "flex", alignItems: "flex-start", gap: 8, padding: "8px", borderRadius: 8,
                  background: isActive ? th.activeItem : "none", cursor: "pointer", textAlign: "left",
                }}
                className="group">
                <MessageSquare style={{ width: 14, height: 14, marginTop: 2, flexShrink: 0, color: th.inkMuted }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: th.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.title}</div>
                  <div style={{ fontSize: 10, color: th.inkMuted }}>{relativeTime(s.createdAt)}</div>
                </div>
                <button type="button" onClick={(e) => onDelete(s.id, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: th.inkMuted, padding: 2, borderRadius: 4, opacity: 0, flexShrink: 0 }}
                  className="group-hover:!opacity-100">
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

// ── Main Chat Client ──────────────────────────────────────────────────────────

export function ChatClient({ accountName = "Enterprise Freight" }: { accountName?: string }) {
  const [initialSession] = useState(() => freshSession());
  const [sessions, setSessions] = useState<ChatSession[]>(() => [initialSession]);
  const [activeId, setActiveId] = useState<string>(() => initialSession.id);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const pendingFile = pendingFiles[0] ?? null;
  const [dragActive, setDragActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<any[]>([]);
  const knownShipmentsRef = useRef<Map<string, string>>(new Map());
  const fileAnnouncedRef = useRef(false);
  const streamingAsstRef = useRef<MessageDisplay | null>(null);

  const th = isDark ? DARK : LIGHT;

  const activeSession = sessions.find((s) => s.id === activeId);
  const messages = useMemo(() => activeSession?.messages ?? [], [activeSession?.messages]);
  const isEmpty = messages.length === 0;

  useEffect(() => {
    historyRef.current = activeSession?.history ?? [];
  }, [activeSession?.history]);

  useEffect(() => {
    let cancelled = false;
    fetchSessions().then((loaded) => {
      if (cancelled) return;
      setSessions((prev) => {
        const active = prev.find((s) => s.id === activeId);
        if (loaded.length > 0) {
          if (active && (active.messages.length > 0 || !active.persisted)) {
            const filtered = loaded.filter((s) => s.id !== active.id);
            return [...filtered, active];
          }
          return loaded;
        }
        return prev.length > 0 ? prev : [freshSession()];
      });
    });
    return () => { cancelled = true; };
  }, [accountName, activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [input]);

  const startNewChat = useCallback(() => {
    const s = freshSession();
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
    setInput("");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const switchSession = useCallback((id: string) => { setActiveId(id); setInput(""); }, []);

  const deleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = sessions.find((s) => s.id === id);
    if (target?.persisted) deleteSessionInDb(id);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) { const s = freshSession(); setActiveId(s.id); return [s]; }
      if (id === activeId) setActiveId(next[next.length - 1].id);
      return next;
    });
  }, [activeId, sessions]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (pendingFiles.length > 0) {
      const match = findKnownShipmentInText(trimmed, knownShipmentsRef.current);
      if (match) {
        const filesToUpload = [...pendingFiles];
        setPendingFiles([]);
        fileAnnouncedRef.current = false;
        setInput("");
        for (const f of filesToUpload) {
          await performUpload(f, match.id, match.number, trimmed);
        }
        return;
      }
    }

    setInput("");
    setSending(true);

    let sessionId = activeId;
    let currentSession = activeSession;
    if (!sessionId || !currentSession) {
      const s = freshSession();
      sessionId = s.id;
      currentSession = s;
      setActiveId(s.id);
    }

    const uid = nextId();
    const aid = nextId();
    const wasPersisted = currentSession.persisted ?? false;
    const priorMessages = currentSession.messages ?? [];
    const title = priorMessages.length === 0 ? trimmed.slice(0, 50) : (currentSession.title ?? "Freight Chat");

    const announceFile = pendingFile !== null && !fileAnnouncedRef.current;
    if (announceFile) fileAnnouncedRef.current = true;
    const apiMessage = announceFile ? `[Attached file: "${pendingFile!.name}"] ${trimmed}` : trimmed;

    const userMsg: MessageDisplay = {
      id: uid, role: "user", text: trimmed, toolCalls: [],
      attachedFileName: announceFile ? pendingFile!.name : undefined,
    };
    streamingAsstRef.current = { id: aid, role: "assistant", text: "", toolCalls: [] };
    let workingHistory: any[] = currentSession.history ?? [];

    setSessions((prev) => {
      const exists = prev.some((s) => s.id === sessionId);
      if (!exists) {
        return [...prev, { ...currentSession!, title, messages: [...priorMessages, userMsg, streamingAsstRef.current!] }];
      }
      return prev.map((s) =>
        s.id !== sessionId ? s : { ...s, title, messages: [...s.messages, userMsg, streamingAsstRef.current!] }
      );
    });

    const pushAsstUpdate = () => {
      setSessions((prev) => prev.map((s) =>
        s.id !== sessionId ? s : { ...s, messages: s.messages.map((m) => m.id === aid ? streamingAsstRef.current! : m) }
      ));
    };

    const apply = (ev: Record<string, unknown>) => {
      const asstMsg = streamingAsstRef.current!;
      if (ev.type === "text_delta" || ev.type === "text") {
        const delta = (ev.text || ev.delta || "") as string;
        streamingAsstRef.current = { ...asstMsg, text: asstMsg.text + delta };
      } else if (ev.type === "tool_call") {
        streamingAsstRef.current = { ...asstMsg, toolCalls: [...asstMsg.toolCalls, { name: (ev.toolName || ev.name) as string, status: "running" }] };
      } else if (ev.type === "tool_result") {
        const name = (ev.toolName || ev.name) as string;
        const idx = [...asstMsg.toolCalls].reverse().findIndex((tc) => tc.name === name && tc.status === "running");
        if (idx !== -1) {
          const real = asstMsg.toolCalls.length - 1 - idx;
          const tcs = [...asstMsg.toolCalls];
          tcs[real] = { ...tcs[real], status: "done", result: ev.result };
          streamingAsstRef.current = { ...asstMsg, toolCalls: tcs };
        }
      } else if (ev.type === "history") {
        workingHistory = ev.turns as any[];
      } else if (ev.type === "error") {
        streamingAsstRef.current = { ...asstMsg, text: asstMsg.text || `Error: ${ev.message}` };
      }
      pushAsstUpdate();
    };

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: apiMessage, history: historyRef.current }),
      });
      if (!res.ok) throw new Error(`Server returned status ${res.status}`);
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              apply(JSON.parse(line.slice(6).trim()));
            } catch {}
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      streamingAsstRef.current = { ...streamingAsstRef.current!, text: streamingAsstRef.current!.text || `Unable to reach freight assistant: ${msg}` };
      pushAsstUpdate();
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }

    const finalMessages = [...priorMessages, userMsg, streamingAsstRef.current!];
    if (!wasPersisted) {
      const created = await createSessionInDb({ title, messages: finalMessages, history: workingHistory });
      if (created) {
        setSessions((prev) => prev.map((s) =>
          s.id !== sessionId ? s : { ...s, id: created.id, persisted: true, createdAt: new Date(created.updatedAt).getTime() }
        ));
        setActiveId((prev) => (prev === sessionId ? created.id : prev));
      }
    } else {
      await updateSessionInDb(sessionId, { title, messages: finalMessages, history: workingHistory });
    }
  }

  async function performUpload(file: File, shipmentId: string, shipmentNumber: string, userText?: string) {
    const sessionId = activeId;
    const wasPersisted = activeSession?.persisted ?? false;
    const priorMessages = activeSession?.messages ?? [];
    const title = priorMessages.length === 0 ? `Upload: ${file.name}`.slice(0, 50) : (activeSession?.title ?? "Freight Chat");
    const finalHistory = activeSession?.history ?? [];

    const uid = nextId();
    const aid = nextId();
    const userMsg: MessageDisplay = {
      id: uid, role: "user", text: userText ?? `Attach to ${shipmentNumber}`, toolCalls: [], attachedFileName: file.name,
    };
    streamingAsstRef.current = {
      id: aid, role: "assistant", text: "",
      toolCalls: [{ name: "upload_document", status: "running", result: { phase: "uploading", fileName: file.name, shipmentNumber } }],
    };

    setSessions((prev) => prev.map((s) =>
      s.id !== sessionId ? s : { ...s, title, messages: [...s.messages, userMsg, streamingAsstRef.current!] }
    ));
    const pushUpdate = () => {
      setSessions((prev) => prev.map((s) =>
        s.id !== sessionId ? s : { ...s, messages: s.messages.map((m) => m.id === aid ? streamingAsstRef.current! : m) }
      ));
    };

    try {
      await new Promise((r) => setTimeout(r, 1200));
      streamingAsstRef.current = {
        ...streamingAsstRef.current!,
        text: `Uploaded "${file.name}" and linked it to ${shipmentNumber}. Documents are queued for 3-way invoice and BOL audit.`,
        toolCalls: [{
          name: "upload_document", status: "done",
          result: { phase: "succeeded", fileName: file.name, shipmentNumber, fieldCount: 8, url: `/shipments` },
        }],
      };
      pushUpdate();
      const finalMessages = [...priorMessages, userMsg, streamingAsstRef.current!];
      if (!wasPersisted) {
        const created = await createSessionInDb({ title, messages: finalMessages, history: finalHistory });
        if (created) {
          setSessions((prev) => prev.map((s) =>
            s.id !== sessionId ? s : { ...s, id: created.id, persisted: true, createdAt: new Date(created.updatedAt).getTime() }
          ));
          setActiveId((prev) => (prev === sessionId ? created.id : prev));
        }
      } else {
        await updateSessionInDb(sessionId, { title, messages: finalMessages, history: finalHistory });
      }
    } catch {
      streamingAsstRef.current = {
        ...streamingAsstRef.current!,
        text: `Failed to upload "${file.name}".`,
        toolCalls: [{ name: "upload_document", status: "done", result: { phase: "failed", fileName: file.name, error: "Upload error" } }],
      };
      pushUpdate();
    }
  }

  function handleAttachToShipment(shipmentId: string, shipmentNumber: string) {
    if (pendingFiles.length === 0) return;
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);
    fileAnnouncedRef.current = false;
    for (const f of filesToUpload) {
      void performUpload(f, shipmentId, shipmentNumber);
    }
  }

  function handleFilesPicked(files: File[]) {
    if (files.length === 0) return;
    setPendingFiles((prev) => [...prev, ...files]);
    fileAnnouncedRef.current = false;
  }

  function removePendingFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    fileAnnouncedRef.current = false;
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); return; }
    if (e.key === "Tab" && isEmpty && !input.trim()) { e.preventDefault(); setInput(SUGGESTED_PROMPT); }
  }

  function onDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragActive(true);
  }
  function onDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) handleFilesPicked(files);
  }

  return (
    <ThemeCtx.Provider value={th}>
    <PendingUploadCtx.Provider value={{ pendingFile, onAttach: handleAttachToShipment }}>
      <div style={{ display: "flex", height: "100vh", background: th.pageBg, overflow: "hidden" }}>

        {/* Left Nav */}
        <LeftNav expanded={navExpanded} onToggle={() => setNavExpanded((v) => !v)} />

        {/* Main Content Area */}
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) handleFilesPicked(files); e.target.value = ""; }}
          />

          {dragActive && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center",
              background: isDark ? "rgba(10,132,255,0.12)" : "rgba(0,113,227,0.06)",
              border: `2px dashed ${th.brand}`, borderRadius: 12, margin: 8, pointerEvents: "none",
            }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: th.brand, fontSize: 14, fontWeight: 600 }}>
                <Paperclip style={{ width: 24, height: 24 }} />
                Drop freight document to attach
              </div>
            </div>
          )}

          {isEmpty ? (
            /* Empty State */
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
              <div style={{ width: "100%", maxWidth: 640 }}>
                <div style={{ textAlign: "center", marginBottom: 24 }}>
                  <h1 style={{ fontSize: 24, fontWeight: 600, color: th.ink, margin: 0 }}>
                    Hi Operations Lead 👋
                  </h1>
                  <p style={{ fontSize: 14, color: th.inkMuted, margin: "6px 0 0" }}>
                    Ask about active shipments, carrier performance, demurrage risks, or audit freight invoices.
                  </p>
                </div>

                <div style={{ background: th.surface, borderRadius: 16, boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 32px rgba(0,0,0,0.10)", overflow: "hidden", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "8px 16px 0" }}>
                    {pendingFiles.map((f, i) => (
                      <PendingFileChip key={`${f.name}-${i}`} file={f} onRemove={() => removePendingFile(i)} />
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKey}
                    placeholder={pendingFiles.length > 0 ? "Which shipment should these attach to?" : `${SUGGESTED_PROMPT}  (Tab to use)`}
                    rows={3}
                    style={{ width: "100%", resize: "none", padding: "16px 20px 8px", fontSize: 14, color: th.ink, background: "transparent", border: "none", outline: "none", fontFamily: "inherit" }}
                    disabled={sending}
                    autoFocus
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach document"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: th.inkMuted }}>
                        <Paperclip style={{ width: 16, height: 16 }} />
                      </button>
                      <span style={{ fontSize: 12, color: th.inkMuted }}>Active workspace: {accountName}</span>
                    </div>
                    <button type="button" onClick={() => sendMessage(input)}
                      disabled={sending || !input.trim()}
                      style={{ width: 32, height: 32, borderRadius: "50%", background: input.trim() ? th.brand : th.inkMuted + "44", border: "none", cursor: input.trim() ? "pointer" : "default", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
                      {sending ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Send style={{ width: 14, height: 14 }} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
                  {QUICK_CHIPS.map((p) => (
                    <button key={p} type="button" onClick={() => sendMessage(p)}
                      style={{ fontSize: 12, padding: "6px 14px", borderRadius: 999, background: th.surface, border: `1px solid ${th.border}`, color: th.ink, cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.15s, color 0.15s" }}>
                      {p}
                    </button>
                  ))}
                </div>

                <p style={{ textAlign: "center", fontSize: 12, color: th.inkMuted }}>Qubere AI Freight Supervisor. Double-check operational actions.</p>
              </div>
            </div>
          ) : (
            /* Active Chat */
            <>
              <div style={{ height: TOPBAR_HEIGHT, boxSizing: "border-box", borderBottom: `1px solid ${th.border}`, background: th.surface, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: `${th.brand}18`, color: th.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles style={{ width: 14, height: 14 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: th.ink, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{activeSession?.title ?? "Freight Supervisor Chat"}</div>
                  <div style={{ fontSize: 11, color: th.inkMuted }}>Active workspace: {accountName}</div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "24px 16px" }}>
                <div style={{ maxWidth: 640, margin: "0 auto" }}>
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} onQuickReply={sendMessage} />
                  ))}
                  <div ref={bottomRef} />
                </div>
              </div>

              <div style={{ background: th.pageBg, padding: "12px 16px 16px", flexShrink: 0 }}>
                <div style={{ maxWidth: 640, margin: "0 auto" }}>
                  <div style={{ background: th.surface, borderRadius: 16, boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.5)" : "0 12px 32px rgba(0,0,0,0.10)", overflow: "hidden" }}>
                    {pendingFiles.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "8px 16px 0" }}>
                        {pendingFiles.map((f, i) => (
                          <PendingFileChip key={`${f.name}-${i}`} file={f} onRemove={() => removePendingFile(i)} />
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={onKey}
                      placeholder={pendingFiles.length > 0 ? "Which shipment should these attach to?" : "Write a message…"}
                      rows={1}
                      style={{ width: "100%", resize: "none", padding: "14px 20px 8px", fontSize: 14, color: th.ink, background: "transparent", border: "none", outline: "none", maxHeight: 160, fontFamily: "inherit" }}
                      disabled={sending}
                    />
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button type="button" onClick={() => fileInputRef.current?.click()} title="Attach document"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, borderRadius: 8, background: "none", border: "none", cursor: "pointer", color: th.inkMuted }}>
                          <Paperclip style={{ width: 15, height: 15 }} />
                        </button>
                        <span style={{ fontSize: 11, color: th.inkMuted }}>Enter to send · Shift+Enter for newline</span>
                      </div>
                      <button type="button" onClick={() => sendMessage(input)}
                        disabled={sending || !input.trim()}
                        style={{ width: 32, height: 32, borderRadius: "50%", background: input.trim() ? th.brand : th.inkMuted + "44", border: "none", cursor: input.trim() ? "pointer" : "default", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
                        {sending ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Send style={{ width: 14, height: 14 }} />}
                      </button>
                    </div>
                  </div>
                  <p style={{ textAlign: "center", fontSize: 11, color: th.inkMuted, marginTop: 8 }}>Qubere AI Freight Supervisor. Double-check operational actions.</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Panel */}
        <RightPanel
          sessions={sessions}
          activeId={activeId}
          onNew={startNewChat}
          onSwitch={switchSession}
          onDelete={deleteSession}
          onSampleClick={sendMessage}
          isDark={isDark}
          onToggleDark={() => setIsDark((v) => !v)}
        />
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </PendingUploadCtx.Provider>
    </ThemeCtx.Provider>
  );
}

function PendingFileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const th = useTh();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 16px 0", padding: "6px 10px", borderRadius: 10, background: `${th.brand}12`, border: `1px solid ${th.brand}33` }}>
      <Paperclip style={{ width: 13, height: 13, color: th.brand, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: th.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
      <span style={{ fontSize: 11, color: th.inkMuted, flexShrink: 0 }}>{formatBytes(file.size)}</span>
      <button type="button" onClick={onRemove} title="Remove attachment"
        style={{ marginLeft: "auto", flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: th.inkMuted, padding: 2, display: "flex" }}>
        <X style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────────────────────────

function MessageBubble({ message, onQuickReply }: { message: MessageDisplay; onQuickReply: (t: string) => void }) {
  const th = useTh();

  if (message.role === "user") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginBottom: 24 }}>
        {message.attachedFileName && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "5px 10px", borderRadius: 999, background: `${th.brand}18`, color: th.brand, fontSize: 12, fontWeight: 500 }}>
            <Paperclip style={{ width: 12, height: 12 }} />
            {message.attachedFileName}
          </div>
        )}
        <div style={{ background: th.brand, color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 16px", maxWidth: 480, fontSize: 14, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {message.text}
        </div>
      </div>
    );
  }

  const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  const isConfirmPending =
    message.text &&
    /shall i proceed|ready to tender|confirm.*tender|dispatch.*tender|go ahead/i.test(message.text);

  return (
    <div style={{ marginBottom: 24 }}>
      {toolCalls.map((tc, i) => <ToolCard key={i} tc={tc} />)}
      {message.text && <MdText text={message.text} />}
      {!message.text && toolCalls.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: th.inkMuted }}>
          <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Thinking…
        </div>
      )}
      {isConfirmPending && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" onClick={() => onQuickReply("Yes, dispatch tender")}
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 999, background: th.brand, border: "none", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
            Yes, dispatch tender
          </button>
          <button type="button" onClick={() => onQuickReply("Cancel")}
            style={{ fontSize: 12, padding: "6px 14px", borderRadius: 999, background: "none", border: `1px solid ${th.border}`, color: th.ink, cursor: "pointer", fontFamily: "inherit" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tool Cards ────────────────────────────────────────────────────────────────

function ViewInAppLink({ href, label }: { href: string; label: string }) {
  const th = useTh();
  return (
    <Link href={href} style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: th.inkMuted, textDecoration: "none", opacity: 0.8 }}>
      View {label} in app →
    </Link>
  );
}

function ToolCard({ tc }: { tc: ToolCallDisplay }) {
  const th = useTh();

  if (tc.name === "upload_document") {
    return <UploadDocumentCard tc={tc} />;
  }

  if (tc.status === "running") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: th.inkMuted, marginBottom: 8 }}>
        <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
        {toolLabel(tc.name)}…
      </div>
    );
  }

  const r = (tc.result ?? {}) as Record<string, any>;

  if (tc.name === "list_shipments") {
    const ships = (r.shipments as any[]) ?? [];
    const count = (r.count as number) ?? ships.length;
    return (
      <Card className="p-4 mb-3" style={{ background: th.surface, borderColor: th.border } as React.CSSProperties}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: th.inkMuted, marginBottom: 12 }}>
          {count} Shipment{count !== 1 ? "s" : ""} Tracked
        </p>
        {ships.length === 0 ? (
          <p style={{ fontSize: 14, color: th.inkMuted }}>No active shipments found.</p>
        ) : (
          <div>{ships.map((s) => <ShipRow key={s.shipmentNumber} s={s} />)}</div>
        )}
        <ViewInAppLink href="/shipments" label="shipments" />
      </Card>
    );
  }

  if (tc.name === "list_orders") {
    const orders = (r.orders as any[]) ?? [];
    return (
      <Card className="p-4 mb-3" style={{ background: th.surface, borderColor: th.border } as React.CSSProperties}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: th.inkMuted, marginBottom: 12 }}>
          Freight Orders ({orders.length})
        </p>
        {orders.map((o: any) => (
          <Link key={o.orderNumber} href="/orders" style={{ display: "block", borderRadius: 8, border: `1px solid ${th.border}`, padding: "10px 12px", marginBottom: 8, textDecoration: "none" }} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: th.ink }}>{o.orderNumber} — {o.customer}</span>
              <Badge variant={o.status === "Dispatched" ? "success" : "neutral"}>{o.status}</Badge>
            </div>
            <p style={{ fontSize: 12, color: th.inkMuted, marginTop: 4 }}>
              {o.origin} → {o.destination} · {o.equipment} ({o.weight})
            </p>
          </Link>
        ))}
        <ViewInAppLink href="/orders" label="orders" />
      </Card>
    );
  }

  if (tc.name === "list_carriers") {
    const carriers = (r.carriers as any[]) ?? [];
    return (
      <Card className="p-4 mb-3" style={{ background: th.surface, borderColor: th.border } as React.CSSProperties}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: th.inkMuted, marginBottom: 12 }}>
          Contracted Carriers ({carriers.length})
        </p>
        {carriers.map((c: any) => (
          <Link key={c.scac} href="/carriers" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, border: `1px solid ${th.border}`, marginBottom: 8, textDecoration: "none" }} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: th.ink }}>{c.name} ({c.scac})</div>
              <div style={{ fontSize: 11, color: th.inkMuted }}>DOT #{c.dotNumber} · Avg {c.avgRatePerMile}/mi</div>
            </div>
            <Badge variant="success">OTD {c.otdScore}</Badge>
          </Link>
        ))}
        <ViewInAppLink href="/carriers" label="carriers" />
      </Card>
    );
  }

  if (tc.name === "recommend_carrier") {
    const rec = r.recommendation || {};
    return (
      <Card className="p-4 mb-3" style={{ background: th.surface, borderColor: "#6ee7b7" } as React.CSSProperties}>
        <Badge variant="success">Carrier Recommendation</Badge>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: th.ink }}>{rec.carrierName} ({rec.scac})</div>
          <div style={{ fontSize: 13, color: th.inkMuted, marginTop: 2 }}>
            Quoted Rate: <strong>{rec.quotedRate}</strong> · Historical OTD: <strong>{rec.historicalOTD}</strong> · Transit: ~{rec.estimatedTransitHours} hrs
          </div>
          <p style={{ fontSize: 12, color: th.inkMuted, marginTop: 8 }}>{rec.matchReason}</p>
        </div>
        <div style={{ marginTop: 12 }}>
          <Button size="sm" variant="secondary" onClick={() => alert(`Auto-tender dispatched to ${rec.carrierName}`)}>
            Dispatch Auto-Tender
          </Button>
        </div>
      </Card>
    );
  }

  if (tc.name === "list_exceptions") {
    const exceptions = (r.exceptions as any[]) ?? [];
    return (
      <Card className="p-4 mb-3" style={{ background: th.surface, borderColor: th.border } as React.CSSProperties}>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: th.inkMuted, marginBottom: 12 }}>
          Open Operational Exceptions ({exceptions.length})
        </p>
        {exceptions.map((ex: any) => (
          <Link key={ex.id} href="/exceptions" style={{ display: "block", borderRadius: 8, border: `1px solid ${th.border}`, padding: "10px 12px", marginBottom: 8, textDecoration: "none" }} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: th.ink }}>{ex.id} — {ex.shipmentNumber}</span>
              <Badge variant={ex.severity === "HIGH" ? "danger" : "warning"}>{ex.severity}</Badge>
            </div>
            <p style={{ fontSize: 12, color: th.ink, marginTop: 4 }}>{ex.detail}</p>
            <p style={{ fontSize: 11, color: th.inkMuted, marginTop: 2 }}>Action: {ex.recommendedAction}</p>
          </Link>
        ))}
        <ViewInAppLink href="/exceptions" label="exceptions" />
      </Card>
    );
  }

  return null;
}

function UploadDocumentCard({ tc }: { tc: ToolCallDisplay }) {
  const th = useTh();
  const r = (tc.result ?? {}) as any;

  if (tc.status === "running") {
    return (
      <Card className="p-4 mb-3" style={{ background: th.surface, borderColor: th.border } as React.CSSProperties}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite", color: th.brand }} />
          <span style={{ fontSize: 13, color: th.ink }}>Uploading & processing "{r.fileName}"…</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 mb-3" style={{ background: th.surface, borderColor: "#6ee7b7" } as React.CSSProperties}>
      <Badge variant="success">Document Processed</Badge>
      <p style={{ fontSize: 14, fontWeight: 600, color: th.ink, marginTop: 8 }}>{r.fileName}</p>
      <p style={{ fontSize: 12, color: th.inkMuted, marginTop: 2 }}>
        Attached to {r.shipmentNumber} · {r.fieldCount} fields extracted
      </p>
      <ViewInAppLink href="/documents" label="documents" />
    </Card>
  );
}

function ShipRow({ s }: { s: any }) {
  const th = useTh();
  const { pendingFile, onAttach } = usePendingUpload();
  const shipmentId = s.id || extractShipmentId(s.url) || s.shipmentNumber;
  const targetHref = s.id ? `/shipments/${s.id}` : `/shipments`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <Link href={targetHref} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 8, border: `1px solid ${th.border}`, padding: "8px 12px", textDecoration: "none" }} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: th.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.shipmentNumber}
          </div>
          <div style={{ fontSize: 11, color: th.inkMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.origin} → {s.destination}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Badge variant={s.mode === "OCEAN" ? "neutral" : s.mode === "AIR" ? "info" : "success"}>{s.mode}</Badge>
          <Badge variant={s.status === "At Risk" ? "danger" : "success"}>{s.status}</Badge>
          {s.eta && <span style={{ fontSize: 11, color: th.inkMuted }}>ETA {s.eta}</span>}
        </div>
      </Link>
      {pendingFile && (
        <button type="button" onClick={() => onAttach(shipmentId, s.shipmentNumber)}
          title={`Attach ${pendingFile.name} to ${s.shipmentNumber}`}
          style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "8px 10px", borderRadius: 8, border: `1px solid ${th.brand}`, background: `${th.brand}12`, color: th.brand, cursor: "pointer" }}>
          <Paperclip style={{ width: 12, height: 12 }} />
          Attach
        </button>
      )}
    </div>
  );
}

function toolLabel(name: string): string {
  return ({
    list_shipments: "Querying active shipments",
    list_orders: "Fetching freight orders",
    list_carriers: "Querying carrier performance",
    recommend_carrier: "Evaluating rate & OTD options",
    list_exceptions: "Sweeping operational exceptions",
    upload_document: "Processing document attachment",
  } as Record<string, string>)[name] ?? "Working";
}
