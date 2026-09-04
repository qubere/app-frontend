import { describe, it, expect } from "vitest";
import { ASSISTANT_TOOLS } from "@/modules/assistant/tools";
import { canUseTool, availableTools } from "@/modules/assistant/shared/toolAccess";
import type { AccountContext } from "@/lib/auth";

/**
 * RBAC gap regression test for the LIVE assistant tool registry.
 *
 * commit af18a33 fixed `create_shipment` shipping with no `permission` in its
 * `access` field — any authenticated account member could create a shipment
 * through the assistant, regardless of whether they held `shipments.create`.
 * Nothing in the suite asserted against `ASSISTANT_TOOLS` itself (the only
 * RBAC coverage that existed, `tests/copilot-rbac.test.ts`, exercised the dead
 * `src/modules/copilot` registry, which the live assistant does not use), so
 * the gap shipped undetected.
 *
 * This test asserts the general shape of that bug can't regress silently: any
 * tool whose name/action is a real-world write must declare a non-empty
 * `access` (a `navHref`, a `permission`, or both) so it is never a softer door
 * than the screen it stands in for. It also pins the specific tool that broke,
 * by name, so a future edit to `create_shipment` that drops its permission
 * again fails immediately and obviously.
 */

// Tools whose `execute` mutates account data (creates/approves/rejects/
// resolves/classifies a record, or can trigger a rescreen), read directly out
// of src/modules/assistant/tools.ts. Every one of these must be gated.
const MUTATING_TOOL_NAMES = [
  "create_shipment",
  "screen_shipment_embargo", // forceRescreen can trigger a pipeline write
  "approve_decision",
  "reject_decision",
  "resolve_exception",
  "classify_product",
] as const;

function hasNonEmptyAccess(access: { navHref?: string; permission?: string } | undefined): boolean {
  return Boolean(access && (access.navHref || access.permission));
}

describe("every mutating assistant tool is gated", () => {
  it("declares MUTATING_TOOL_NAMES as a subset of the live registry", () => {
    const registryNames = new Set(ASSISTANT_TOOLS.map((t) => t.declaration.name));
    for (const name of MUTATING_TOOL_NAMES) {
      expect(registryNames.has(name), `expected ${name} to still exist in ASSISTANT_TOOLS`).toBe(true);
    }
  });

  it("gates every known write-capable tool with a navHref or a permission", () => {
    for (const name of MUTATING_TOOL_NAMES) {
      const tool = ASSISTANT_TOOLS.find((t) => t.declaration.name === name);
      expect(tool, `tool ${name} not found`).toBeDefined();
      expect(
        hasNonEmptyAccess(tool!.access),
        `${name} is a write-capable tool but declares no access gate`
      ).toBe(true);
    }
  });

  it("flags any tool whose name reads as a write action but carries no access gate", () => {
    // General form of the bug: catch a *new* tool being added (or an existing
    // one edited) with an obvious write verb in its name and no access gate,
    // without hand-maintaining an exhaustive keyword list of every possible
    // write verb.
    const writeVerbPattern =
      /^(create|update|delete|remove|approve|reject|resolve|submit|transmit|classify|cancel|void|amend|screen)/;

    const ungatedWriteTools = ASSISTANT_TOOLS.filter(
      (tool) => writeVerbPattern.test(tool.declaration.name ?? "") && !hasNonEmptyAccess(tool.access)
    ).map((tool) => tool.declaration.name);

    expect(ungatedWriteTools).toEqual([]);
  });
});

describe("create_shipment specifically requires shipments.create", () => {
  const tool = ASSISTANT_TOOLS.find((t) => t.declaration.name === "create_shipment");

  it("is present in the registry", () => {
    expect(tool).toBeDefined();
  });

  it("pins the exact access gate fixed in af18a33", () => {
    expect(tool?.access?.permission).toBe("shipments.create");
    expect(tool?.access?.navHref).toBe("/app/shipments");
  });

  function accountContext(overrides: Partial<AccountContext> = {}): AccountContext {
    return {
      userId: "user_1",
      accountId: "acct_alpha",
      isPlatformAdmin: false,
      roleNames: ["MEMBER"],
      permissions: [],
      ...overrides,
    } as unknown as AccountContext;
  }

  it("is refused to a member without shipments.create", () => {
    expect(canUseTool(accountContext(), tool?.access)).toBe(false);
  });

  it("is allowed once the permission is held", () => {
    expect(canUseTool(accountContext({ permissions: ["shipments.create"] }), tool?.access)).toBe(true);
  });

  it("is offered by availableTools once granted, and withheld otherwise", () => {
    const denied = availableTools(accountContext(), ASSISTANT_TOOLS as any);
    expect(denied.map((t: any) => t.declaration.name)).not.toContain("create_shipment");

    const granted = availableTools(
      accountContext({ permissions: ["shipments.create"] }),
      ASSISTANT_TOOLS as any
    );
    expect(granted.map((t: any) => t.declaration.name)).toContain("create_shipment");
  });
});
