import { DomainError } from "./error";

/** Do not retry financial writes silently: the broker must review the new balance. */
export function rethrowWorkflowConflict(error: unknown): never {
  if (error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String(error.code))) {
    throw new DomainError("Another update completed first. Refresh, review the current values, and confirm again.", "WORKFLOW_CONFLICT", 409);
  }
  throw error;
}
