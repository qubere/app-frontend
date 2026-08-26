import { describe, it, expect, beforeEach, vi } from "vitest";

// Turbopack/webpack HMR re-evaluates packages/db/src/index.ts on unrelated
// file changes during `next dev`. The PrismaClient singleton already
// survives that (cached on globalThis). Its dataMode/accountId
// AsyncLocalStorage instances did not: each reload minted fresh ones, while
// the cached client's $allOperations middleware stayed closed over the
// original pair. withDataModeContext(null, ...) called after a reload then
// set context nobody was reading, and the middleware silently fell back to
// its "no context" default (re-applying tenant/dataMode filters a caller
// had explicitly bypassed) instead of seeing the bypass.
//
// This can't drive real Turbopack HMR, but it can assert the fix's actual
// mechanism: a fresh module evaluation (simulated with vi.resetModules())
// must reuse the same AsyncLocalStorage instances from globalThis rather
// than minting new ones.

const globalKey = globalThis as unknown as {
  __qubereDataModeStorage?: unknown;
  __qubereAccountIdStorage?: unknown;
};

beforeEach(() => {
  delete globalKey.__qubereDataModeStorage;
  delete globalKey.__qubereAccountIdStorage;
});

describe("packages/db context storage survives module re-evaluation", () => {
  it("reuses the same AsyncLocalStorage instances across a simulated HMR reload", async () => {
    vi.resetModules();
    const first = await import("@qubere/db");
    expect(globalKey.__qubereDataModeStorage).toBeDefined();
    expect(globalKey.__qubereAccountIdStorage).toBeDefined();
    const dataModeStorageAfterFirstLoad = globalKey.__qubereDataModeStorage;
    const accountIdStorageAfterFirstLoad = globalKey.__qubereAccountIdStorage;

    // Simulate Turbopack re-evaluating the module (new module instance, new
    // top-level `const dataModeStorage = new AsyncLocalStorage(...)`) while
    // globalThis -- and the cached PrismaClient closed over the first
    // module's storage -- survive.
    vi.resetModules();
    const second = await import("@qubere/db");

    expect(globalKey.__qubereDataModeStorage).toBe(dataModeStorageAfterFirstLoad);
    expect(globalKey.__qubereAccountIdStorage).toBe(accountIdStorageAfterFirstLoad);

    // The real regression: a bypass set by the SECOND module's exported
    // function must be visible to the FIRST module's getter (standing in
    // for the cached Prisma middleware's closure) -- and vice versa. Before
    // the fix this failed because each import created its own storage.
    await first.withDataModeContext(null, async () => {
      expect(second.getDataModeContext()).toBeNull();
    });
    await second.withAccountIdContext(null, async () => {
      expect(first.getAccountIdContext()).toBeNull();
    });
  });
});
