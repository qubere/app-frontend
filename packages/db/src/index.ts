import { PrismaClient, Prisma } from "@prisma/client";
import type { AsyncLocalStorage } from "node:async_hooks";
import type { DataMode } from "./dataMode";

export * from "./dataMode";
export * from "./environment";
export * from "./caseNumber";

class DummyAsyncLocalStorage<T> {
  run<R>(_store: T, callback: () => R): R {
    return callback();
  }
  getStore(): T | undefined {
    return undefined;
  }
}

function createAsyncLocalStorage<T>(): AsyncLocalStorage<T> {
  if (typeof (globalThis as any).window === "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NodeAsyncLocalStorage = require("async_hooks").AsyncLocalStorage as new <U>() => AsyncLocalStorage<U>;
      return new NodeAsyncLocalStorage<T>();
    } catch {
      // Fallback if async_hooks is unavailable
    }
  }
  return new DummyAsyncLocalStorage<T>() as unknown as AsyncLocalStorage<T>;
}

// Cached on globalThis, same reasoning as the PrismaClient singleton further
// down this file: Turbopack/webpack HMR re-evaluates this module on
// unrelated file changes during `next dev`, which would otherwise mint a
// fresh AsyncLocalStorage instance on every reload. The cached `db` client
// (also globalThis-cached, so it survives those same reloads) closes over
// whichever dataModeStorage/accountIdStorage instance existed the moment it
// was first built -- so once the two drift apart, every later
// withDataModeContext/runWithAccountId call sets context on an instance the
// middleware never reads. getDataModeContext()/getAccountIdContext() then
// see no context at all (`undefined`, not the caller's explicit `null`
// bypass), and buildIsolatedQueryArgs's `contextMode ?? "PRODUCTION"`
// fallback quietly re-applies the dataMode filter a platform-admin query
// had explicitly opted out of. Confirmed empirically: a fresh process
// returns the right rows, but the same query against a dev server that had
// been hot-reloading for a while silently dropped them.
const globalForDbContext = globalThis as unknown as {
  __qubereDataModeStorage?: any;
  __qubereAccountIdStorage?: any;
};

const dataModeStorage =
  globalForDbContext.__qubereDataModeStorage ?? createAsyncLocalStorage<{ mode: DataMode | null }>();
if (process.env.NODE_ENV !== "production") {
  globalForDbContext.__qubereDataModeStorage = dataModeStorage;
}

/**
 * Execute a function within an explicit DataMode context.
 * If mode is null, dataMode query isolation is bypassed (e.g. for cross-tenant platform administration).
 */
export function runWithDataMode<T>(mode: DataMode | null | undefined, fn: () => T): T {
  if (!mode && mode !== null) {
    return fn();
  }
  return dataModeStorage.run({ mode }, fn);
}

/**
 * Async wrapper for runWithDataMode.
 */
export function withDataModeContext<T>(mode: DataMode | null | undefined, fn: () => Promise<T>): Promise<T> {
  if (!mode && mode !== null) {
    return fn();
  }
  return dataModeStorage.run({ mode }, fn);
}

/**
 * Retrieve the current active DataMode context (undefined if no context has been explicitly set).
 */
export function getDataModeContext(): DataMode | null | undefined {
  return dataModeStorage.getStore()?.mode;
}

const accountIdStorage =
  globalForDbContext.__qubereAccountIdStorage ?? createAsyncLocalStorage<{ accountId: string | null }>();
if (process.env.NODE_ENV !== "production") {
  globalForDbContext.__qubereAccountIdStorage = accountIdStorage;
}

/**
 * Execute a function within an explicit tenant (accountId) context. Unlike DataMode,
 * there is no sensible default tenant -- an undefined accountId bypasses isolation
 * entirely (e.g. cron/background jobs with no single-tenant scope), and an explicit
 * null is a deliberate cross-tenant opt-out (e.g. platform admin operations).
 */
export function runWithAccountId<T>(accountId: string | null | undefined, fn: () => T): T {
  if (accountId === undefined) {
    return fn();
  }
  return accountIdStorage.run({ accountId }, fn);
}

/**
 * Async wrapper for runWithAccountId.
 */
export function withAccountIdContext<T>(accountId: string | null | undefined, fn: () => Promise<T>): Promise<T> {
  if (accountId === undefined) {
    return fn();
  }
  return accountIdStorage.run({ accountId }, fn);
}

/**
 * Retrieve the current active tenant (accountId) context (undefined if no context
 * has been explicitly set).
 */
export function getAccountIdContext(): string | null | undefined {
  return accountIdStorage.getStore()?.accountId;
}

// Build lookup maps for models with dataMode fields or account relations from Prisma DMMF
const modelsWithDataMode = new Set<string>();
const modelsWithAccountRelation = new Set<string>();
// Tenant-isolation injection only targets models with a REQUIRED accountId field --
// the 4 nullable-accountId models (e.g. Role, which has global system roles with
// accountId: null) are deliberately excluded: auto-injecting accountId there would
// silently exclude legitimate global rows from queries that intentionally span both.
const modelsWithRequiredAccountId = new Set<string>();

/**
 * Prisma model names (PascalCase, as in schema.prisma) that carry a required
 * accountId field. Exposed so static checks (see tenant-context-adoption.test.ts)
 * can recognize genuinely tenant-scoped Prisma calls without hand-maintaining a
 * duplicate list that drifts from the schema.
 */
export function getTenantScopedModelNames(): string[] {
  return Array.from(modelsWithRequiredAccountId);
}

if (Prisma.dmmf?.datamodel?.models) {
  for (const model of Prisma.dmmf.datamodel.models) {
    const fieldNames = new Set(model.fields.map((f) => f.name));
    if (fieldNames.has("dataMode")) {
      modelsWithDataMode.add(model.name);
    }
    if (fieldNames.has("account") && model.name !== "Role") {
      modelsWithAccountRelation.add(model.name);
    }
    const accountIdField = model.fields.find((f) => f.name === "accountId");
    if (accountIdField && accountIdField.isRequired) {
      modelsWithRequiredAccountId.add(model.name);
    }
  }
}

// Actions eligible for tenant-isolation injection. Wider than DataMode's set --
// it also covers singular update/delete/upsert, since a cross-tenant write is a
// more severe failure mode than a cross-tenant read. Extended-where-unique-input
// (confirmed on this Prisma version) allows a plain scalar accountId filter
// alongside the required unique selector for update/delete/upsert, so no
// findUnique-style demotion is needed here.
const TENANT_INTERCEPTED_ACTIONS = [
  "findMany",
  "findFirst",
  "findUnique",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
  "update",
  "delete",
  "upsert",
];

export function buildTenantIsolatedQueryArgs(
  model: string,
  operation: string,
  args: any,
  contextAccountId: string | null | undefined
): any {
  if (!TENANT_INTERCEPTED_ACTIONS.includes(operation)) {
    return args;
  }

  // No context (undefined) or an explicit cross-tenant opt-out (null) bypasses isolation.
  if (contextAccountId === undefined || contextAccountId === null) {
    return args;
  }

  if (!modelsWithRequiredAccountId.has(model)) {
    return args;
  }

  const queryArgs = args || {};
  const where = (queryArgs as any).where || {};

  // Caller already specified an accountId filter (including an explicit null,
  // relevant for the nullable models this function otherwise skips) -- leave it alone.
  if (where.accountId !== undefined) {
    return args;
  }

  return {
    ...queryArgs,
    where: {
      ...where,
      accountId: contextAccountId,
    },
  };
}

const INTERCEPTED_ACTIONS = [
  "findMany",
  "findFirst",
  "findUnique",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
];

export function buildIsolatedQueryArgs(
  model: string,
  operation: string,
  args: any,
  contextMode: DataMode | null | undefined
): { newArgs: any; effectiveOperation: string } {
  if (!INTERCEPTED_ACTIONS.includes(operation)) {
    return { newArgs: args, effectiveOperation: operation };
  }

  // Explicit null context bypasses isolation
  if (contextMode === null) {
    return { newArgs: args, effectiveOperation: operation };
  }

  const targetMode: DataMode = contextMode ?? "PRODUCTION";
  const queryArgs = args || {};
  const where = (queryArgs as any).where || {};

  const hasExplicitDataMode =
    where.dataMode !== undefined ||
    (where.account &&
      typeof where.account === "object" &&
      where.account !== null &&
      where.account.dataMode !== undefined);

  if (hasExplicitDataMode) {
    return { newArgs: args, effectiveOperation: operation };
  }

  const hasDataModeField = modelsWithDataMode.has(model);
  const hasAccountRel = modelsWithAccountRelation.has(model) && model !== "Role";

  if (!hasDataModeField && !hasAccountRel) {
    return { newArgs: args, effectiveOperation: operation };
  }

  const newArgs: any = { ...queryArgs };
  let effectiveOperation = operation;

  if (hasDataModeField) {
    newArgs.where = {
      ...where,
      dataMode: targetMode,
    };
    if (operation === "findUnique") {
      effectiveOperation = "findFirst";
    }
  } else if (hasAccountRel) {
    const existingAccount =
      typeof where.account === "object" && where.account !== null ? where.account : {};
    newArgs.where = {
      ...where,
      account: {
        ...existingAccount,
        dataMode: targetMode,
      },
    };
    if (operation === "findUnique") {
      effectiveOperation = "findFirst";
    }
  }

  return { newArgs, effectiveOperation };
}

export const rawDb = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  transactionOptions: { maxWait: 15000, timeout: 30000 },
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = (globalForPrisma.prisma ??
  rawDb.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const contextMode = getDataModeContext();
          const { newArgs: dataModeArgs, effectiveOperation } = buildIsolatedQueryArgs(
            model,
            operation,
            args,
            contextMode
          );

          const contextAccountId = getAccountIdContext();
          const newArgs = buildTenantIsolatedQueryArgs(model, operation, dataModeArgs, contextAccountId);

          if (effectiveOperation === "findFirst" && operation === "findUnique") {
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const delegate = (rawDb as any)[modelKey];
            if (delegate && typeof delegate.findFirst === "function") {
              let finalArgs = newArgs;
              if (newArgs && newArgs.where && typeof newArgs.where === "object") {
                const flattenedWhere = { ...newArgs.where };
                let modified = false;
                for (const key of Object.keys(flattenedWhere)) {
                  if (
                    key.includes("_") &&
                    typeof flattenedWhere[key] === "object" &&
                    flattenedWhere[key] !== null &&
                    !Array.isArray(flattenedWhere[key])
                  ) {
                    const compoundObj = flattenedWhere[key];
                    delete flattenedWhere[key];
                    Object.assign(flattenedWhere, compoundObj);
                    modified = true;
                  }
                }
                if (modified) {
                  finalArgs = { ...newArgs, where: flattenedWhere };
                }
              }
              return delegate.findFirst(finalArgs);
            }
          }

          return query(newArgs);
        },
      },
    },
  })) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export async function acquireDocumentWorkerLease(
  name: string,
  ownerId: string,
  ttlMs: number
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const rows = await rawDb.$queryRaw<Array<{ name: string }>>`
    INSERT INTO "DocumentWorkerLease" ("name", "ownerId", "expiresAt", "updatedAt")
    VALUES (${name}, ${ownerId}, ${expiresAt}, NOW())
    ON CONFLICT ("name") DO UPDATE
      SET "ownerId" = EXCLUDED."ownerId", "expiresAt" = EXCLUDED."expiresAt", "updatedAt" = NOW()
      WHERE "DocumentWorkerLease"."expiresAt" <= NOW()
    RETURNING "name"
  `;
  return rows.length === 1;
}

export async function renewDocumentWorkerLease(name: string, ownerId: string, ttlMs: number): Promise<boolean> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const changed = await rawDb.$executeRaw`
    UPDATE "DocumentWorkerLease" SET "expiresAt" = ${expiresAt}, "updatedAt" = NOW()
    WHERE "name" = ${name} AND "ownerId" = ${ownerId}
  `;
  return changed === 1;
}

export async function releaseDocumentWorkerLease(name: string, ownerId: string): Promise<void> {
  await rawDb.$executeRaw`
    DELETE FROM "DocumentWorkerLease" WHERE "name" = ${name} AND "ownerId" = ${ownerId}
  `;
}
