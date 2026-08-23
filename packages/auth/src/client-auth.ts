export interface CanCheckOptions {
  permissions?: string[];
  roleNames?: string[];
  isPlatformAdmin?: boolean;
  authorizedClientIds?: string[];
  isAllClients?: boolean;
  clientId?: string;
}

/**
 * Client-side permission helper: answers WHAT a user can do and WHICH data/resources they can do it to.
 */
export function can(permission: string, options: CanCheckOptions = {}): boolean {
  const {
    permissions = [],
    roleNames = [],
    isPlatformAdmin = false,
    authorizedClientIds = [],
    isAllClients = false,
    clientId,
  } = options;

  if (isPlatformAdmin || roleNames.includes("OWNER") || roleNames.includes("BROKER_ADMIN") || roleNames.includes("TMS_ADMIN")) {
    return true;
  }

  const hasPerm = permissions.includes(permission);
  if (!hasPerm) return false;

  if (clientId && !isAllClients) {
    return authorizedClientIds.includes(clientId);
  }

  return true;
}
