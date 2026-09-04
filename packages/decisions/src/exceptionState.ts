export const EXCEPTION_STATES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_IMPORTER",
  "WAITING_FOR_DOCUMENT",
  "READY_FOR_REVIEW",
  "RESOLVED",
  "WAIVED",
  "CANCELLED",
] as const;

export type ExceptionState = (typeof EXCEPTION_STATES)[number];

export const TERMINAL_EXCEPTION_STATES: readonly ExceptionState[] = [
  "RESOLVED",
  "WAIVED",
  "CANCELLED",
];

export const REASONED_EXCEPTION_STATES: readonly ExceptionState[] = ["RESOLVED", "WAIVED"];

function collapse(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const BY_COLLAPSED = new Map(EXCEPTION_STATES.map((state) => [collapse(state), state]));

export function normalizeExceptionStatus(raw: string | null | undefined): ExceptionState | null {
  if (typeof raw !== "string") return null;
  return BY_COLLAPSED.get(collapse(raw)) ?? null;
}

export function isTerminalExceptionState(status: ExceptionState): boolean {
  return TERMINAL_EXCEPTION_STATES.includes(status);
}

export function requiresResolutionReason(status: ExceptionState): boolean {
  return REASONED_EXCEPTION_STATES.includes(status);
}

export const RISK_ACCEPTANCE_PERMISSION = "exceptions.waive";

export function isRiskAcceptance(status: ExceptionState): boolean {
  return status === "WAIVED";
}

export function statusVariants(state: ExceptionState): string[] {
  const pascal = state
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join("");
  return pascal === state ? [state] : [state, pascal];
}

export function openStatusVariants(): string[] {
  const variants = new Set<string>();
  for (const state of EXCEPTION_STATES) {
    if (isTerminalExceptionState(state)) continue;
    for (const variant of statusVariants(state)) variants.add(variant);
  }
  return [...variants];
}

export function exceptionStatusLabel(raw: string | null | undefined): string {
  const state = normalizeExceptionStatus(raw);
  if (!state) return typeof raw === "string" && raw.trim() ? raw.trim() : "Unknown";
  return state
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}
