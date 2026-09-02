import { Prisma } from "@prisma/client";
import { db, withDataModeContext } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { normalizeSenderEmail } from "./emailNormalization";

export interface ResolvedInboundRoute {
  id: string;
  accountId: string;
  defaultAssignedToUserId: string | null;
}

export interface InboundRouteLookup {
  findActiveByNormalizedEmail(normalizedEmail: string): Promise<ResolvedInboundRoute | null>;
}

export const databaseInboundRouteLookup: InboundRouteLookup = {
  async findActiveByNormalizedEmail(normalizedEmail) {
    // Sender routing happens before the email has a tenant. Keep the bypass at
    // the repository boundary so callers cannot accidentally hide valid routes
    // behind the default account.dataMode filter.
    return withDataModeContext(null, async () => {
      const routes = await db.inboundSenderRoute.findMany({
        where: { normalizedSenderEmail: normalizedEmail, clientId: null, status: "ACTIVE" },
        select: { id: true, accountId: true, defaultAssignedToUserId: true }, take: 2,
      });
      return routes.length === 1 ? routes[0] : null;
    });
  },
};

export async function resolveBlockedInboundRoute(rawSenderEmail: string): Promise<ResolvedInboundRoute | null> {
  const normalized = normalizeSenderEmail(rawSenderEmail);
  return withDataModeContext(null, async () =>
    db.inboundSenderRoute.findFirst({
      where: { normalizedSenderEmail: normalized, clientId: null, status: "BLOCKED" },
      select: { id: true, accountId: true, defaultAssignedToUserId: true },
    })
  );
}

/** Legacy shared inbox: resolve only one unambiguous account-level sender route. */
export async function resolveInboundRoute(
  rawSenderEmail: string,
  lookup: InboundRouteLookup = databaseInboundRouteLookup
): Promise<ResolvedInboundRoute | null> {
  const normalized = normalizeSenderEmail(rawSenderEmail);
  const route = await lookup.findActiveByNormalizedEmail(normalized);
  console.log("[SenderRouting] resolveInboundRoute", {
    rawSenderEmail,
    normalized,
    matched: !!route,
    accountId: route?.accountId ?? null,
  });
  return route;
}

/** Defensive guard for an unexpected cross-account record at the write boundary. */
export class InboundSenderAlreadyRoutedError extends Error {
  constructor() {
    super("This email address is outside the current workspace and cannot be changed here.");
    this.name = "InboundSenderAlreadyRoutedError";
  }
}

/** Thrown when re-adding a sender whose existing route for this account was
 * deliberately BLOCKED. A block is a durable admin decision -- unlike a
 * REVOKED route (safe to silently reactivate; it just expired/was replaced),
 * lifting a block must be its own explicit action, not a side effect of
 * someone re-submitting "Add Authorized Sender" with the same address. */
export class InboundSenderBlockedError extends Error {
  constructor() {
    super("This sender is blocked for this destination. Unblock it explicitly before re-adding.");
    this.name = "InboundSenderBlockedError";
  }
}

/**
 * Authorizes `email` to route inbound documents into `accountId`, going
 * forward. Shared by the Settings > Inbound Senders UI and the platform-admin
 * quarantine release flow. Rules are unique within account/client scope;
 * the same sender may be authorized for multiple destinations.
 */
export async function createInboundSenderRoute(params: {
  accountId: string;
  clientId?: string | null;
  email: string;
  defaultAssignedToUserId?: string | null;
  createdByUserId: string;
  auditSource?: string;
  requestId?: string;
}) {
  const { accountId, email, defaultAssignedToUserId, createdByUserId, auditSource = "UI", requestId } = params;
  const normalizedSenderEmail = normalizeSenderEmail(email);
  const scopeKey = params.clientId ?? "";
  if (params.clientId && !await db.client.findFirst({ where: { id: params.clientId, accountId }, select: { id: true } })) throw new Error("CLIENT_NOT_FOUND");
  const senderKey = { accountId_scopeKey_normalizedSenderEmail: { accountId, scopeKey, normalizedSenderEmail } };

  const reactivateExisting = async (existing: { id: string; accountId: string; status: string }) => {
    if (existing.accountId !== accountId) throw new InboundSenderAlreadyRoutedError();
    if (existing.status === "BLOCKED") throw new InboundSenderBlockedError();

    const route = await db.inboundSenderRoute.update({
      where: { id: existing.id },
      data: {
        displaySenderEmail: email.trim(),
        defaultAssignedToUserId: defaultAssignedToUserId ?? null,
        status: "ACTIVE",
      },
    });

    await createAuditLog({
      accountId,
      userId: createdByUserId,
      action: existing.status === "ACTIVE" ? "inbound_sender_route.updated" : "inbound_sender_route.reactivated",
      entity: "InboundSenderRoute",
      entityId: route.id,
      source: auditSource,
      metadata: {
        normalizedSenderEmail,
        previousStatus: existing.status,
        defaultAssignedToUserId: defaultAssignedToUserId ?? null,
      },
      requestId,
    });

    return route;
  };

  const existing = await withDataModeContext(null, async () =>
    db.inboundSenderRoute.findUnique({
      where: senderKey,
      select: { id: true, accountId: true, status: true },
    })
  );
  if (existing) return reactivateExisting(existing);

  try {
    const route = await db.inboundSenderRoute.create({
      data: {
        accountId,
        normalizedSenderEmail,
        scopeKey,
        clientId: params.clientId ?? null,
        displaySenderEmail: email.trim(),
        defaultAssignedToUserId: defaultAssignedToUserId ?? null,
        createdByUserId,
      },
    });

    await createAuditLog({
      accountId,
      userId: createdByUserId,
      action: "inbound_sender_route.created",
      entity: "InboundSenderRoute",
      entityId: route.id,
      source: auditSource,
      metadata: { normalizedSenderEmail, defaultAssignedToUserId: defaultAssignedToUserId ?? null },
      requestId,
    });

    return route;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Close the create race without turning a same-account retry into a
      // misleading "authorized elsewhere" error.
      const raced = await withDataModeContext(null, async () =>
        db.inboundSenderRoute.findUnique({
          where: senderKey,
          select: { id: true, accountId: true, status: true },
        })
      );
      if (raced) return reactivateExisting(raced);
      throw new InboundSenderAlreadyRoutedError();
    }
    throw error;
  }
}

export async function blockInboundSenderRoute(params: {
  accountId: string;
  clientId?: string | null;
  email: string;
  blockedByUserId: string;
  auditSource?: string;
  requestId?: string;
}) {
  const { accountId, email, blockedByUserId, auditSource = "UI", requestId } = params;
  const normalizedSenderEmail = normalizeSenderEmail(email);
  const scopeKey = params.clientId ?? "";
  if (params.clientId && !await db.client.findFirst({ where: { id: params.clientId, accountId }, select: { id: true } })) throw new Error("CLIENT_NOT_FOUND");
  const senderKey = { accountId_scopeKey_normalizedSenderEmail: { accountId, scopeKey, normalizedSenderEmail } };

  const existing = await withDataModeContext(null, async () =>
    db.inboundSenderRoute.findUnique({ where: senderKey })
  );
  if (existing && existing.accountId !== accountId) throw new InboundSenderAlreadyRoutedError();

  const route = existing
    ? await db.inboundSenderRoute.update({
        where: { id: existing.id },
        data: { displaySenderEmail: email.trim(), status: "BLOCKED", defaultAssignedToUserId: null },
      })
    : await db.inboundSenderRoute.create({
        data: {
          accountId,
          normalizedSenderEmail,
          scopeKey,
          clientId: params.clientId ?? null,
          displaySenderEmail: email.trim(),
          defaultAssignedToUserId: null,
          status: "BLOCKED",
          createdByUserId: blockedByUserId,
        },
      });

  await createAuditLog({
    accountId,
    userId: blockedByUserId,
    action: "inbound_sender_route.blocked",
    entity: "InboundSenderRoute",
    entityId: route.id,
    source: auditSource,
    metadata: { normalizedSenderEmail },
    requestId,
  });

  return route;
}
