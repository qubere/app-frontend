import { describe, it, expect, afterEach } from "vitest";
import net from "node:net";
import {
  clamdInstreamScan,
  scanForMalware,
  clamavConfigured,
  isSafeToProcess,
} from "@/lib/security/clamav";

/**
 * Spins up a fake clamd that speaks just enough of the INSTREAM protocol:
 * reads `zINSTREAM\0`, then length-prefixed chunks until a zero-length chunk,
 * then replies with `verdict` and closes.
 */
function fakeClamd(verdict: string): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let seenTerminator = false;
      const buf: Buffer[] = [];
      socket.on("data", (d) => {
        buf.push(d);
        const all = Buffer.concat(buf);
        // crude: once we've seen the 4 zero bytes terminator near the end
        if (all.length >= 4 && all.subarray(-4).equals(Buffer.from([0, 0, 0, 0]))) {
          seenTerminator = true;
        }
        if (seenTerminator) {
          socket.end(`${verdict}\0`);
        }
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ port: addr.port, close: () => server.close() });
    });
  });
}

const ENV_KEYS = ["MALWARE_SCAN_ENABLED", "CLAMAV_HOST", "CLAMAV_PORT", "VIRUSTOTAL_API_KEY"];
const saved: Record<string, string | undefined> = {};
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
function setEnv(vars: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("clamdInstreamScan", () => {
  it("returns CLEAN on 'stream: OK'", async () => {
    const clamd = await fakeClamd("stream: OK");
    try {
      const r = await clamdInstreamScan(Buffer.from("hello world"), {
        host: "127.0.0.1",
        port: clamd.port,
        timeoutMs: 2000,
      });
      expect(r).toEqual({ status: "CLEAN", scanner: "clamav" });
    } finally {
      clamd.close();
    }
  });

  it("returns INFECTED with the signature name on FOUND", async () => {
    const clamd = await fakeClamd("stream: Eicar-Test-Signature FOUND");
    try {
      const r = await clamdInstreamScan(Buffer.from("x"), { host: "127.0.0.1", port: clamd.port, timeoutMs: 2000 });
      expect(r.status).toBe("INFECTED");
      expect(r.detail).toBe("Eicar-Test-Signature");
    } finally {
      clamd.close();
    }
  });

  it("rejects when the connection fails", async () => {
    await expect(
      clamdInstreamScan(Buffer.from("x"), { host: "127.0.0.1", port: 1, timeoutMs: 1000 })
    ).rejects.toThrow();
  });
});

describe("scanForMalware", () => {
  it("is SKIPPED when no scanner is configured", async () => {
    setEnv({ CLAMAV_HOST: undefined, VIRUSTOTAL_API_KEY: undefined });
    const r = await scanForMalware({ bytes: Buffer.from("x") });
    expect(r.status).toBe("SKIPPED");
  });

  it("is ERROR (fail-closed) when clamd is configured but unreachable", async () => {
    setEnv({ CLAMAV_HOST: "127.0.0.1", CLAMAV_PORT: "1", MALWARE_SCAN_ENABLED: undefined });
    const r = await scanForMalware({ bytes: Buffer.from("x") });
    expect(r.status).toBe("ERROR");
  });

  it("MALWARE_SCAN_ENABLED=false disables even with a host set", async () => {
    setEnv({ CLAMAV_HOST: "127.0.0.1", MALWARE_SCAN_ENABLED: "false" });
    expect(clamavConfigured()).toBe(false);
    const r = await scanForMalware({ bytes: Buffer.from("x") });
    expect(r.status).toBe("SKIPPED");
  });
});

describe("isSafeToProcess", () => {
  it("only CLEAN and SKIPPED are safe", () => {
    expect(isSafeToProcess("CLEAN")).toBe(true);
    expect(isSafeToProcess("SKIPPED")).toBe(true);
    expect(isSafeToProcess("INFECTED")).toBe(false);
    expect(isSafeToProcess("ERROR")).toBe(false);
  });
});
