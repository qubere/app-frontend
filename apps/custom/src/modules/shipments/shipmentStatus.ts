/**
 * Shipment.status is a plain string, not a Prisma enum (see schema.prisma's
 * comment on the field), and each creation path previously hardcoded its own
 * initial-status literal with no shared reference point. Naming both here
 * doesn't merge them to one value -- the two paths intentionally start a
 * shipment at different points in the lifecycle -- but it gives future call
 * sites one place to read the canonical initial value from instead of
 * re-typing (and risking a typo'd) literal.
 */

// In-app "New Shipment" flow: created empty, needs a user to fill it in.
export const MANUAL_INTAKE_INITIAL_STATUS = "Draft";

// External ERP intake API: created with importer/line-item data already
// populated, so it starts past the drafting stage.
export const ERP_INTAKE_INITIAL_STATUS = "In Progress";

// Matches the vocabulary documented in schema.prisma's comment on
// Shipment.status; any value outside this list is not persistable.
// "DELIVERED" and "Delivered with Exception" are written by apps/tms's POD
// pipeline (podPipeline.ts) once a shipment completes freight execution --
// included here so apps/custom's status checks recognize them instead of
// treating a TMS-delivered shipment as an invalid/non-terminal status.
export const SHIPMENT_STATUSES = [
  "Draft",
  "In Progress",
  "Ready to File",
  "On Hold",
  "Submitted",
  "Completed",
  "DELIVERED",
  "Delivered with Exception",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return typeof value === "string" && (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

/** Statuses from which no further status change is legal. */
export const TERMINAL_SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  "Submitted",
  "Completed",
  "DELIVERED",
  "Delivered with Exception",
];

export function isTerminalShipmentStatus(status: string): boolean {
  return isShipmentStatus(status) && TERMINAL_SHIPMENT_STATUSES.includes(status);
}

export class ShipmentStatusTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string
  ) {
    super(
      !isShipmentStatus(to)
        ? `"${to}" is not a valid shipment status.`
        : `Shipment cannot move from terminal status "${from}" to "${to}".`
    );
    this.name = "ShipmentStatusTransitionError";
  }
}

/**
 * Rejects a proposed Shipment.status write. Deliberately does not enforce a
 * linear ordering between the non-terminal statuses (Draft / In Progress /
 * Ready to File / On Hold) -- no product rule documents one, and inventing
 * one here risks blocking legitimate operator workflows. It only guards the
 * two properties that are actually known to matter: the value must be one of
 * the documented statuses, and once a shipment reaches a terminal status it
 * cannot be moved to a different one.
 */
export function assertShipmentStatusTransition(from: string, to: string): void {
  if (from === to) return;
  if (!isShipmentStatus(to) || isTerminalShipmentStatus(from)) {
    throw new ShipmentStatusTransitionError(from, to);
  }
}
