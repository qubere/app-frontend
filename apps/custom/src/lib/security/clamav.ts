/**
 * ClamAV-backed malware scanning for uploaded / ingested documents.
 *
 * Complements the cheap in-process heuristics in `malwareScanner.ts`
 * (EICAR string, double extensions, executable magic bytes) with a real
 * signature engine. `clamd` cannot run inside a Vercel function -- it needs
 * ~1.4 GB resident RAM and a persistent process -- so the daemon lives
 * elsewhere (recommended: a ClamAV container on Cloud Run, min-instances 1)
 * and this module talks to it over the INSTREAM TCP protocol.
 *
 * Fail-closed: if the scanner is configured but unreachable, the result is
 * ERROR, and callers treat ERROR the same as INFECTED (quarantine, no parse).
 * When no scanner is configured (local dev), the result is SKIPPED and the
 * document flows through untouched.
 *
 * Config (all optional):
 *   MALWARE_SCAN_ENABLED   "false" to force-disable even if a host is set
 *   CLAMAV_HOST            clamd host; presence of this is what enables scanning
 *   CLAMAV_PORT            clamd port (default 3310)
 *   CLAMAV_TIMEOUT_MS      per-scan socket timeout (default 20000)
 *   VIRUSTOTAL_API_KEY     if set, a hash-only VirusTotal pre-check runs first
 *                          (the file is never uploaded -- only its SHA-256)
 */

import net from "node:net";

export type MalwareScanStatus = "CLEAN" | "INFECTED" | "SKIPPED" | "ERROR";

export interface ClamavScanResult {
  status: MalwareScanStatus;
  /** ClamAV signature name on INFECTED; short reason on ERROR/SKIPPED. */
  detail?: string;
  /** Which scanner produced this ("clamav", "virustotal", "none", "cached"). */
  scanner: string;
}

export interface ClamavScanInput {
  bytes: Buffer;
  /** SHA-256 hex of `bytes`, if the caller already computed it. */
  sha256?: string;
  fileName?: string;
}

const CHUNK_SIZE = 64 * 1024;

/**
 * Streams `bytes` to clamd via `zINSTREAM` and returns its verdict. Throws on
 * connection / protocol failure so the caller can map it to ERROR.
 */
export async function clamdInstreamScan(
  bytes: Buffer,
  opts: { host: string; port: number; timeoutMs: number }
): Promise<ClamavScanResult> {
  return new Promise<ClamavScanResult>((resolve, reject) => {
    const socket = net.createConnection({ host: opts.host, port: opts.port });
    const chunks: Buffer[] = [];
    let settled = false;

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      fn();
    };

    socket.setTimeout(opts.timeoutMs);
    socket.on("timeout", () => done(() => reject(new Error("clamd timeout"))));
    socket.on("error", (err) => done(() => reject(err)));
    socket.on("data", (d) => chunks.push(d));
    socket.on("end", () => {
      const reply = Buffer.concat(chunks).toString("utf8").replace(/\0/g, "").trim();
      // "stream: OK" | "stream: Eicar-Test-Signature FOUND" | "... ERROR"
      if (/\bOK$/.test(reply)) {
        done(() => resolve({ status: "CLEAN", scanner: "clamav" }));
      } else if (/FOUND$/.test(reply)) {
        const sig = reply.replace(/^stream:\s*/, "").replace(/\s*FOUND$/, "");
        done(() => resolve({ status: "INFECTED", detail: sig, scanner: "clamav" }));
      } else {
        done(() => reject(new Error(`clamd unexpected reply: ${reply || "<empty>"}`)));
      }
    });

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        const chunk = bytes.subarray(offset, offset + CHUNK_SIZE);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(chunk.length, 0);
        socket.write(header);
        socket.write(chunk);
      }
      // Zero-length chunk terminates the stream.
      socket.write(Buffer.from([0, 0, 0, 0]));
    });
  });
}

/**
 * Looks up a file hash in VirusTotal. Returns INFECTED when at least
 * `minDetections` engines flag it, CLEAN/`null` otherwise. Never uploads the
 * file -- only the hash leaves our infra, and an unknown hash is not a verdict.
 */
export async function virusTotalHashLookup(
  sha256: string,
  apiKey: string,
  minDetections = 2
): Promise<ClamavScanResult | null> {
  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { "x-apikey": apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null; // hash unknown -- defer to clamd
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { attributes?: { last_analysis_stats?: { malicious?: number; suspicious?: number } } };
    };
    const stats = body.data?.attributes?.last_analysis_stats;
    const hits = (stats?.malicious ?? 0) + (stats?.suspicious ?? 0);
    if (hits >= minDetections) {
      return { status: "INFECTED", detail: `VirusTotal: ${hits} engines`, scanner: "virustotal" };
    }
    return { status: "CLEAN", scanner: "virustotal" };
  } catch {
    return null; // best-effort pre-check; never blocks on its own failure
  }
}

export function clamavConfigured(): boolean {
  if ((process.env.MALWARE_SCAN_ENABLED ?? "").toLowerCase() === "false") return false;
  return Boolean(process.env.CLAMAV_HOST);
}

/**
 * Scan `input.bytes`. Order: VirusTotal hash pre-check (if keyed) for an
 * instant known-bad rejection, then clamd. A configured-but-unreachable clamd
 * yields ERROR (fail-closed). No scanner configured yields SKIPPED.
 */
export async function scanForMalware(input: ClamavScanInput): Promise<ClamavScanResult> {
  const vtKey = process.env.VIRUSTOTAL_API_KEY?.trim();
  if (vtKey && input.sha256) {
    const vt = await virusTotalHashLookup(input.sha256, vtKey);
    if (vt?.status === "INFECTED") return vt;
  }

  if (!clamavConfigured()) {
    return { status: "SKIPPED", detail: "no scanner configured", scanner: "none" };
  }

  const host = process.env.CLAMAV_HOST as string;
  const port = Number(process.env.CLAMAV_PORT ?? 3310);
  const timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS ?? 20_000);

  try {
    return await clamdInstreamScan(input.bytes, { host, port, timeoutMs });
  } catch (err) {
    return { status: "ERROR", detail: err instanceof Error ? err.message : String(err), scanner: "clamav" };
  }
}

/** A document is safe to process only when explicitly CLEAN or SKIPPED. */
export function isSafeToProcess(status: MalwareScanStatus): boolean {
  return status === "CLEAN" || status === "SKIPPED";
}
