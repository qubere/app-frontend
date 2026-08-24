export interface NavAccess {
  roleNames: string[];
  permissions: string[];
  isPlatformAdmin: boolean;
}

export type NavIcon =
  | "operations"
  | "shipments"
  | "orders"
  | "carriers"
  | "tenders"
  | "quotes"
  | "invoices"
  | "exceptions"
  | "documents"
  | "chat"
  | "integrations"
  | "data"
  | "account"
  | "users"
  | "roles"
  | "settings"
  | "platform"
  | "billing";

export interface NavItem {
  id: string;
  labelKey: string;
  href: string;
  icon: NavIcon;
  roles?: string[];
  permission?: string;
  platformAdminOnly?: boolean;
  badge?: number;
}

export interface NavSection {
  id: string;
  labelKey: string;
  items: NavItem[];
  hiddenFromSidebar?: boolean;
  renderAs?: "pills";
}

export const ACCOUNT_ADMIN_ROLES = ["OWNER", "ADMIN", "DISPATCHER"];

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "operations",
    labelKey: "mainOperations",
    items: [
      { id: "exceptions", labelKey: "action", href: "/", icon: "exceptions" },
      { id: "operations", labelKey: "commandCenter", href: "/command-center", icon: "operations" },
      { id: "orders", labelKey: "orders", href: "/orders", icon: "orders" },
      { id: "shipments", labelKey: "shipments", href: "/shipments", icon: "shipments" },
      { id: "tenders", labelKey: "tenders", href: "/tenders", icon: "tenders" },
    ],
  },
  {
    id: "freightExecution",
    labelKey: "freightExecution",
    renderAs: "pills",
    items: [
      { id: "carriers", labelKey: "carriers", href: "/carriers", icon: "carriers" },
      { id: "quotes", labelKey: "quotes", href: "/quotes", icon: "quotes" },
      { id: "invoices", labelKey: "invoices", href: "/invoices", icon: "invoices" },
      { id: "billing", labelKey: "customerBilling", href: "/billing", icon: "billing", permission: "billing.view" },
      { id: "documents", labelKey: "freightDocs", href: "/documents", icon: "documents" },
      { id: "integrations", labelKey: "integrations", href: "/admin/integrations", icon: "integrations" },
      { id: "settings", labelKey: "systemSettings", href: "/admin/settings", icon: "settings" },
    ],
  },
  {
    id: "administration",
    labelKey: "accountAdmin",
    hiddenFromSidebar: true,
    items: [
      {
        id: "account",
        labelKey: "accountProfile",
        href: "/admin",
        icon: "account",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "account.manage",
      },
      {
        id: "users",
        labelKey: "userManagement",
        href: "/admin/users",
        icon: "users",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "users.manage",
      },
      {
        id: "roles",
        labelKey: "rolesPermissions",
        href: "/admin/roles",
        icon: "roles",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "users.manage",
      },
      {
        id: "settings",
        labelKey: "settingsAudit",
        href: "/admin/settings",
        icon: "settings",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "settings.manage",
      },
      {
        id: "documentEmail",
        labelKey: "documentEmail",
        href: "/admin/settings",
        icon: "settings",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "settings.manage",
      },
      {
        id: "integrations",
        labelKey: "integrations",
        href: "/admin/integrations",
        icon: "integrations",
        roles: ACCOUNT_ADMIN_ROLES,
        permission: "settings.manage",
      },
    ],
  },
  {
    id: "platform",
    labelKey: "platformAdmin",
    items: [
      {
        id: "console",
        labelKey: "qubereConsole",
        href: "/platform-admin",
        icon: "platform",
        platformAdminOnly: true,
      },
    ],
  },
];

export const UNLISTED_NAV_ITEMS: NavItem[] = [];

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

export function accountAdminItems(access: NavAccess, sections: NavSection[] = NAV_SECTIONS): NavItem[] {
  const section = sections.find((s) => s.id === "administration");
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

export function canAccessHref(access: NavAccess, href: string, sections: NavSection[] = NAV_SECTIONS): boolean {
  const item = navItemByHref(href, sections);
  return item ? canAccessNavItem(access, item) : false;
}

export function isPathWithin(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(href.endsWith("/") ? href : `${href}/`);
}

export function activeNavHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (isPathWithin(pathname, href) && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
}
