/**
 * The permission catalogue.
 *
 * Every permission this codebase gates on is listed here, next to the role names
 * that should hold it by default.
 */

export const SYSTEM_ROLES = ["OWNER", "ADMIN", "BROKER", "SPECIALIST", "REVIEWER", "MEMBER", "VIEWER"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

export interface PermissionDefinition {
  name: string;
  /** What holding it lets a person do, in the words the admin screen shows. */
  description: string;
  /** Grouping for display only. */
  category: "Account" | "Documents" | "Decisions" | "Filing" | "Compliance" | "Intelligence" | "Products" | "Parties" | "Post-Entry" | "Billing" | "Freight";
  /** Roles that receive it when the catalogue is synced. */
  defaultRoles: readonly SystemRole[];
}

const ALL_BUT_VIEWER: readonly SystemRole[] = ["OWNER", "ADMIN", "BROKER", "SPECIALIST", "MEMBER"];
const ADMIN_ONLY: readonly SystemRole[] = ["OWNER", "ADMIN"];

export const PERMISSION_CATALOGUE: readonly PermissionDefinition[] = [
  // ─── Account ────────────────────────────────────────────────────────────
  {
    name: "account.manage",
    description: "Change account settings and company details.",
    category: "Account",
    defaultRoles: ["OWNER"],
  },
  {
    name: "roles.manage",
    description: "Create and edit custom roles and their permission sets.",
    category: "Account",
    defaultRoles: ["OWNER"],
  },
  {
    name: "users.read",
    description: "View team members and their roles.",
    category: "Account",
    defaultRoles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  },
  {
    name: "users.manage",
    description: "Invite people, change their role, and deactivate them.",
    category: "Account",
    defaultRoles: ADMIN_ONLY,
  },
  {
    name: "settings.manage",
    description: "Change workspace configuration and integrations.",
    category: "Account",
    defaultRoles: ["OWNER"],
  },
  // ─── Documents ──────────────────────────────────────────────────────────
  {
    name: "documents.read",
    description: "View uploaded trade documents.",
    category: "Documents",
    defaultRoles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  },
  {
    name: "documents.create",
    description: "Upload new trade documents into a shipment.",
    category: "Documents",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "documents.delete",
    description: "Delete trade documents from a shipment.",
    category: "Documents",
    defaultRoles: ADMIN_ONLY,
  },
  // ─── Decisions ──────────────────────────────────────────────────────────
  {
    name: "decisions.read",
    description: "View agent decision history and line item recommendations.",
    category: "Decisions",
    defaultRoles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  },
  {
    name: "decisions.approve",
    description: "Accept an agent decision and apply it to the shipment.",
    category: "Decisions",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "decisions.reject",
    description: "Reject an agent decision and send it back.",
    category: "Decisions",
    defaultRoles: ADMIN_ONLY,
  },
  {
    name: "decisions.reevaluate",
    description: "Run an agent again over the same shipment.",
    category: "Decisions",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "decisions.override",
    description: "Replace a proposed classification with a different one.",
    category: "Decisions",
    defaultRoles: ADMIN_ONLY,
  },
  // ─── Exceptions / Risk ──────────────────────────────────────────────────
  {
    name: "exceptions.read",
    description: "View open exceptions and their details.",
    category: "Compliance",
    defaultRoles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  },
  {
    name: "exceptions.resolve",
    description: "Mark an exception as resolved after the underlying issue is fixed.",
    category: "Compliance",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "exceptions.waive",
    description: "Close an exception without fixing the problem (risk acceptance).",
    category: "Compliance",
    defaultRoles: ADMIN_ONLY,
  },
  {
    name: "risk.accept",
    description: "Accept and acknowledge a compliance risk on behalf of the account.",
    category: "Compliance",
    defaultRoles: ADMIN_ONLY,
  },
  // ─── Filing ─────────────────────────────────────────────────────────────
  {
    name: "filing.read",
    description: "View customs filings and their statuses.",
    category: "Filing",
    defaultRoles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  },
  {
    name: "filings.create",
    description: "Create new customs filing records.",
    category: "Filing",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "customs.create",
    description: "Create customs cases and filing packages.",
    category: "Filing",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "customs.handoff",
    description: "Send TMS shipments to the Customs workspace.",
    category: "Filing",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "filings.submit",
    description: "Transmit an entry to customs.",
    category: "Filing",
    defaultRoles: ALL_BUT_VIEWER,
  },
  // ─── Freight Execution ──────────────────────────────────────────────────
  {
    name: "tms.access",
    description: "Access the Qubere TMS AI Freight Execution application.",
    category: "Freight",
    defaultRoles: ["OWNER", "ADMIN", "MEMBER"],
  },
  {
    name: "transportationOrders.read",
    description: "View transportation orders and details.",
    category: "Freight",
    defaultRoles: ["OWNER", "ADMIN", "MEMBER", "VIEWER"],
  },
  {
    name: "transportationOrders.write",
    description: "Create, edit, or promote transportation orders.",
    category: "Freight",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "carriers.manage",
    description: "Manage carrier master data and configurations.",
    category: "Freight",
    defaultRoles: ADMIN_ONLY,
  },
  {
    name: "tenders.send",
    description: "Send and manage carrier tenders.",
    category: "Freight",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "carrierInvoices.match",
    description: "Match and process carrier freight invoices.",
    category: "Freight",
    defaultRoles: ALL_BUT_VIEWER,
  },
  {
    name: "carrierInvoices.override",
    description: "Override carrier invoice discrepancies (risk acceptance).",
    category: "Freight",
    defaultRoles: ADMIN_ONLY,
  },
] as const;

export const PERMISSION_NAMES = PERMISSION_CATALOGUE.map((p) => p.name);
export type PermissionName = (typeof PERMISSION_NAMES)[number];

export function findPermission(name: string): PermissionDefinition | null {
  return PERMISSION_CATALOGUE.find((p) => p.name === name) ?? null;
}

export function defaultPermissionsForRole(roleName: string): string[] {
  const role = roleName.toUpperCase() as SystemRole;
  return PERMISSION_CATALOGUE.filter((p) => p.defaultRoles.includes(role)).map((p) => p.name);
}

export interface CatalogueCoverage {
  missing: string[];
  unknown: string[];
  seeded: number;
  total: number;
}

export function catalogueCoverage(existingNames: readonly string[]): CatalogueCoverage {
  const existing = new Set(existingNames);
  const catalogued = new Set(PERMISSION_NAMES);
  return {
    missing: PERMISSION_NAMES.filter((name) => !existing.has(name)),
    unknown: [...existing].filter((name) => !catalogued.has(name)).sort(),
    seeded: PERMISSION_NAMES.filter((name) => existing.has(name)).length,
    total: PERMISSION_NAMES.length,
  };
}

export interface RoleGrantGap {
  roleName: string;
  missing: string[];
  extra: string[];
}

export function roleGrantGap(roleName: string, granted: readonly string[]): RoleGrantGap {
  const defaults = defaultPermissionsForRole(roleName);
  const held = new Set(granted);
  const defaultSet = new Set(defaults);
  return {
    roleName,
    missing: defaults.filter((name) => !held.has(name)),
    extra: [...held].filter((name) => !defaultSet.has(name)).sort(),
  };
}
