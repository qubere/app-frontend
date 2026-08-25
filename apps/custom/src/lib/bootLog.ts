/**
 * One-line-per-target boot log of what this server instance actually
 * connected to. Exists because DB connection strings (pooled vs. direct,
 * which pooler mode) and deploy identity are otherwise invisible until
 * something misbehaves — a stale process or a wrong env var then looks
 * identical to a real data problem. Never logs credentials.
 *
 * Node-only module: instrumentation.ts dynamically imports this so the
 * edge-runtime bundler never statically parses process.pid/child_process,
 * which it flags even inside a runtime-guarded branch of the same file.
 */
import { execSync } from "node:child_process";

export function logBootConnections() {
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    gitCommitShaFromWorkingTree() ??
    "unknown";

  const lines = [
    `[boot] commit=${commit.slice(0, 12)} env=${process.env.NODE_ENV ?? "unknown"} pid=${process.pid} startedAt=${new Date().toISOString()}`,
    `[boot] database=${redactedDbTarget(process.env.DATABASE_URL)}`,
  ];
  if (process.env.DIRECT_URL) {
    lines.push(`[boot] database.direct=${redactedDbTarget(process.env.DIRECT_URL)}`);
  }
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    lines.push(`[boot] clerk.instance=${clerkInstanceFromPublishableKey(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)}`);
  }

   
  console.log(lines.join("\n"));
}

function redactedDbTarget(url: string | undefined): string {
  if (!url) return "NOT SET";
  try {
    const u = new URL(url);
    const poolerMode = u.port === "6543" ? "transaction-pooler" : u.port === "5432" ? "direct-or-session-pooler" : "unknown";
    return `${u.hostname}:${u.port || "5432"}/${u.pathname.replace(/^\//, "")} mode=${poolerMode} pgbouncer=${u.searchParams.get("pgbouncer") ?? "false"}`;
  } catch {
    return "unparseable";
  }
}

function clerkInstanceFromPublishableKey(key: string): string {
  // pk_test_<base64(domain$)> / pk_live_<base64(domain$)>
  const [, mode, encoded] = key.split("_");
  if (!encoded) return "unparseable";
  try {
    const domain = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
    return `${mode ?? "unknown"}:${domain}`;
  } catch {
    return "unparseable";
  }
}

function gitCommitShaFromWorkingTree(): string | null {
  try {
    // Local dev only — best-effort, must never throw or block boot.
    return execSync("git rev-parse HEAD", { cwd: __dirname, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}
