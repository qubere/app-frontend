export interface NavAccess {
  roleNames: string[];
  permissions: string[];
  isPlatformAdmin: boolean;
}

export type NavIcon =
  | "inbox"
  | "dashboard"
  | "shipments"
  | "products"
  | "parties"
  | "clients"
  | "importersOfRecord"
  | "bonds"
  | "poa"
  | "documents"
  | "tradeRepository"
  | "actions"
  | "decisions"
  | "exceptions"
  | "filing"
  | "regulatory"
  | "account"
  | "users"
  | "roles"
  | "settings"
  | "platform"
  | "vault"
  | "compliance"
  | "simulator"
  | "classification"
  | "postEntry"
  | "tradeData"
  | "tariffs"
  | "billing"
  | "reports"
  | "licenses"
  | "onboarding"
  | "brokerCompliance"
  | "support";

export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: NavIcon;
  /** Roles that may see the item, in addition to OWNER and platform admins. */
  roles?: string[];
  /** Permission that also grants visibility when the caller's role is not listed. */
  permission?: string;
  platformAdminOnly?: boolean;
  /** Optional live count shown as a badge. Populated externally, not in the static definition. */
  badge?: number;
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
  /** Rendered by the header account menu instead, but still authorizes its routes. */
  hiddenFromSidebar?: boolean;
  /** Suppress the section header -- used for the pinned Today / Command Center rows. */
  hideLabel?: boolean;
  /**
   * When true, the section renders as an accordion in the sidebar: its header is a
   * toggle and its items are shown only while it is the open section. Sections
   * without this flag are always fully expanded (the pinned rows).
   */
  collapsible?: boolean;
}

export const ACCOUNT_ADMIN_ROLES = ["OWNER", "ADMIN"];

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "primary",
    labelKey: "primary",
    hideLabel: true,
    items: [
      { id: "actions", labelKey: "today", href: "/app/actions", icon: "actions" },
      { id: "dashboard", labelKey: "commandCenter", href: "/app/dashboard", icon: "dashboard" },
    ],
  },
  {
    id: "operations",
    labelKey: "mainOperations",
    collapsible: true,
    items: [
      { id: "shipments", labelKey: "shipments", href: "/app/shipments", icon: "shipments" },
      { id: "documents", labelKey: "documents", href: "/app/documents", icon: "documents" },
      { id: "trade-repository", labelKey: "tradeRepository", href: "/app/trade-repository", icon: "tradeRepository", permission: "document.read" },
      { id: "filing", labelKey: "customsFiling", href: "/app/filing", icon: "filing" },
      { id: "classification", labelKey: "classificationInbox", href: "/app/classification", icon: "classification", permission: "classification.read" },
      { id: "post-entry", labelKey: "postEntry", href: "/app/post-entry", icon: "postEntry" },
      { id: "vault", labelKey: "dutyRecovery", href: "/app/vault", icon: "vault" },
    ],
  },
  {
    id: "compliance-licensing",
    labelKey: "complianceAndLicensing",
    collapsible: true,
    items: [
      { id: "compliance", labelKey: "complianceMonitoring", href: "/app/compliance", icon: "compliance" },
      { id: "license-management", labelKey: "licenseManagement", href: "/app/license-management", icon: "licenses", permission: "licenses.view" },
      { id: "regulatory", labelKey: "regulatoryUpdates", href: "/app/regulatory", icon: "regulatory" },
    ],
  },
  {
    id: "data-intelligence",
    labelKey: "dataAndIntelligence",
    collapsible: true,
    items: [
      { id: "trade-data", labelKey: "tradeData", href: "/app/trade-data", icon: "tradeData" },
      { id: "hts", labelKey: "htsWorkspace", href: "/app/hts", icon: "tariffs" },
      { id: "simulator", labelKey: "tariffSimulator", href: "/app/simulator", icon: "simulator" },
      { id: "intelligence", labelKey: "intelligencePanels", href: "/app/intelligence", icon: "reports" },
    ],
  },
  {
    id: "billing",
    labelKey: "billingWorkspace",
    collapsible: true,
    items: [
      { id: "billing", labelKey: "billing", href: "/app/billing", icon: "billing", permission: "billing.view" },
      { id: "billing-exceptions", labelKey: "billingExceptions", href: "/app/billing/exceptions", icon: "exceptions", permission: "billing.exception.view" },
    ],
  },
  {
    id: "management",
    labelKey: "management",
    collapsible: true,
    items: [
      { id: "onboarding", labelKey: "onboarding", href: "/app/onboarding", icon: "onboarding", permission: "onboarding.manage" },
      { id: "clients", labelKey: "clientsAndEntities", href: "/app/clients", icon: "clients" },
      { id: "importers-of-record", labelKey: "importersOfRecord", href: "/app/importers-of-record", icon: "importersOfRecord" },
      { id: "bonds", labelKey: "bonds", href: "/app/bonds", icon: "bonds" },
      { id: "poa", labelKey: "poa", href: "/app/poa", icon: "poa" },
    ],
  },
  {
    id: "administration",
    labelKey: "accountAdmin",
    hiddenFromSidebar: true,
    items: [
      {
        id: "broker-compliance",
        labelKey: "brokerCompliance",
        href: "/app/admin/broker-compliance",
        icon: "brokerCompliance",
        permission: "broker_compliance.manage",
      },
      {
        id: "account",
        labelKey: "accountProfile",
        href: "/app/admin",
        icon: "account",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "account.manage",
      },
      {
        id: "users",
        labelKey: "userManagement",
        href: "/app/admin/users",
        icon: "users",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "users.manage",
      },
      {
        id: "roles",
        labelKey: "rolesPermissions",
        href: "/app/admin/roles",
        icon: "roles",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "users.manage",
      },
      {
        id: "settings",
        labelKey: "settingsAudit",
        href: "/app/admin/settings",
        icon: "settings",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "settings.manage",
      },
      {
        id: "documentEmail",
        labelKey: "documentEmail",
        href: "/app/admin/settings",
        icon: "settings",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "settings.manage",
      },
      {
        id: "integrations",
        labelKey: "Integrations & APIs",
        href: "/app/admin/integrations",
        icon: "settings",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "settings.manage",
      },
    ],
  },
  {
    id: "platform",
    labelKey: "platformAdmin",
    // The header account menu renders these for platform admins; the tenant
    // sidebar must not carry cross-tenant tools. canAccessHref still authorizes
    // the routes.
    hiddenFromSidebar: true,
    items: [
      {
        id: "console",
        labelKey: "qubereConsole",
        href: "/platform-admin",
        icon: "platform",
        platformAdminOnly: true,
      },
      {
        id: "filingConfig",
        labelKey: "filingConfiguration",
        href: "/app/filing-config",
        icon: "settings",
        platformAdminOnly: true,
      },
    ],
  },
];

/**
 * Routes that are authorized and reachable by direct link but not shown as their
 * own sidebar row -- they have a prominent in-app entry point elsewhere:
 *   - products / parties: reached from the Trade Data hub (/app/trade-data)
 *   - reconciliation: reached from the Post-Entry hub (/app/post-entry)
 *   - tariffs: the old hub, now redirects to /app/regulatory
 *   - compliance-reports: now the "Reports" tab of /app/compliance
 * navItemByHref() falls back to this list so canAccessHref() (and the Copilot's
 * tool gate) still resolve them.
 */
export const UNLISTED_NAV_ITEMS: NavItem[] = [
  { id: "support", labelKey: "helpCenter", href: "/app/support", icon: "support" },
  { id: "products", labelKey: "products", href: "/app/products", icon: "products" },
  { id: "parties", labelKey: "parties", href: "/app/parties", icon: "parties" },
  { id: "reconciliation", labelKey: "reconciliation", href: "/app/reconciliation", icon: "postEntry" },
  { id: "tariffs", labelKey: "tariffsAndRegulations", href: "/app/tariffs", icon: "tariffs" },
  { id: "compliance-reports", labelKey: "complianceReports", href: "/app/compliance-reports", icon: "reports", permission: "compliance.reports.view" },
];

/** Mirrors hasPermission() in src/lib/auth.ts: platform admins and OWNER bypass checks. */
export function canAccessNavItem(access: NavAccess, item: NavItem): boolean {
  if (item.platformAdminOnly) {
    return access.isPlatformAdmin;
  }
  if (access.isPlatformAdmin || access.roleNames.includes("OWNER")) {
    return true;
  }
  if (item.roles?.some((role) => access.roleNames.includes(role))) {
    return true;
  }
  if (item.permission) {
    return access.permissions.includes(item.permission);
  }
  return !item.roles;
}

/** The administration section's items, filtered by access -- regardless of hiddenFromSidebar, since this backs the header's Manage Account menu rather than the sidebar. */
export function accountAdminItems(access: NavAccess, sections: NavSection[] = NAV_SECTIONS): NavItem[] {
  const section = sections.find((s) => s.id === "administration");
  if (!section) return [];
  return section.items.filter((item) => canAccessNavItem(access, item));
}

/** The platform section's items, filtered by access -- backs the header account menu, not the sidebar. */
export function platformConsoleItems(access: NavAccess, sections: NavSection[] = NAV_SECTIONS): NavItem[] {
  const section = sections.find((s) => s.id === "platform");
  if (!section) return [];
  return section.items.filter((item) => canAccessNavItem(access, item));
}

export function visibleNavigation(access: NavAccess, sections: NavSection[] = NAV_SECTIONS): NavSection[] {
  return sections
    .filter((section) => !section.hiddenFromSidebar)
    .map((section) => ({ ...section, items: section.items.filter((item) => canAccessNavItem(access, item)) }))
    .filter((section) => section.items.length > 0);
}

export function navItemByHref(href: string, sections: NavSection[] = NAV_SECTIONS): NavItem | undefined {
  const fromSections = sections.flatMap((section) => section.items).find((item) => item.href === href);
  if (fromSections) return fromSections;
  return UNLISTED_NAV_ITEMS.find((item) => item.href === href);
}

/** Server-side guard for a routed page. Unknown hrefs fail closed. */
export function canAccessHref(access: NavAccess, href: string, sections: NavSection[] = NAV_SECTIONS): boolean {
  const item = navItemByHref(href, sections);
  return item ? canAccessNavItem(access, item) : false;
}

/** True when href is pathname or one of its ancestors, matched on segment boundaries. */
export function isPathWithin(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith("/") ? href : `${href}/`);
}

/**
 * Longest match wins, so /app/admin/users highlights itself rather than /app/admin,
 * and /app/shipments does not highlight for /app/shipments-archive.
 */
export function activeNavHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (isPathWithin(pathname, href) && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}
