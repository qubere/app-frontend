import { createAuthGuards, type AuthGuardDeps } from "@qubere/auth";
import { getAccountContext, hasPermission, hasProductEntitlement } from "@/lib/auth";
import { runWithAccountId, runWithDataMode } from "@/lib/db";
import { logApiRequest } from "@/lib/logging/logger";

// Built via the shared factory so apps/custom and apps/tms run the exact
// same authorization/route-wrapping logic, while each app still supplies
// its own (locally re-exported, test-mockable) getAccountContext/db/logger
// primitives instead of importing them straight from @qubere/auth.
// Each dep is wrapped in a thunk rather than passed by direct reference so
// that the underlying binding is only read at call time -- matching the
// original code's lazy access. A plain `{ hasProductEntitlement }` shorthand
// reads the binding eagerly here at module load, which throws for any test
// that mocks "@/lib/auth" without stubbing every one of these exports (most
// only stub the ones their scenario actually exercises).
const guards = createAuthGuards({
  getAccountContext: (...args) => getAccountContext(...args),
  hasPermission: (...args) => hasPermission(...args),
  hasProductEntitlement: (...args) => hasProductEntitlement(...args),
  // These two additionally fall back to running the callback unscoped when
  // a test's "@/lib/db" mock doesn't stub them at all -- the same
  // graceful-degradation the pre-consolidation implementation had. The
  // reference must be read inside a try/catch, not a `typeof` check: a
  // Vitest mock throws on ANY access to an export it didn't stub (even a
  // `typeof` read), so `typeof runWithAccountId === "function"` throws
  // instead of evaluating to false.
  runWithAccountId: (accountId, fn) => {
    let runner: typeof runWithAccountId | null = null;
    try {
      runner = runWithAccountId;
    } catch {
      runner = null;
    }
    return typeof runner === "function" ? runner(accountId, fn) : fn();
  },
  runWithDataMode: (dataMode: string, fn) => {
    let runner: typeof runWithDataMode | null = null;
    try {
      runner = runWithDataMode;
    } catch {
      runner = null;
    }
    return typeof runner === "function"
      ? runner(dataMode as Parameters<typeof runWithDataMode>[0], fn)
      : fn();
  },
  logApiRequest: (...args) => logApiRequest(...args),
} as AuthGuardDeps);

export const {
  authorizeRequest,
  authorizeResourceRequest,
  authorizeWrite,
  withAuthenticatedRoute,
  withPublicRoute,
  withCronRoute,
} = guards;

export type {
  AuthenticatedRouteHandler,
  PermissionRequirement,
  RouteHandlerArgs,
  PublicRouteHandlerArgs,
} from "@qubere/auth";
