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
    return withDataModeContext(null, async () =>
      db.inboundSenderRoute.findFirst({
        where: { normalizedSenderEmail: normalizedEmail, status: "ACTIVE" },
        select: { id: true, accountId: true, defaultAssignedToUserId: true },
      })
    );
  },
};

export async function resolveBlockedInboundRoute(rawSenderEmail: string): Promise<ResolvedInboundRoute | null> {
  const normalized = normalizeSenderEmail(rawSenderEmail);
  return withDataModeContext(null, async () =>
    db.inboundSenderRoute.findFirst({
      where: { normalizedSenderEmail: normalized, status: "BLOCKED" },
      select: { id: true, accountId: true, defaultAssignedToUserId: true },
    })
  );
}

/**
 * Resolves the single active route for a sender, if any.
 *
 * The `normalizedSenderEmail` column is globally unique (see
 * prisma/schema.prisma), so this can never return routes belonging to two
 * different accounts for the same sender -- that guarantee lives at the
 * database level, not here.
 */
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

/** Thrown when the sender is already routed to a different account -- the
 * `normalizedSenderEmail` unique constraint is what actually enforces this. */
export class InboundSenderAlreadyRoutedError extends Error {
  constructor() {
    super("This email address is already authorized elsewhere and cannot be added here.");
    this.name = "InboundSenderAlreadyRoutedError";
  }
}

/**
 * Authorizes `email` to route inbound documents into `accountId`, going
 * forward. Shared by the Settings > Inbound Senders UI and the platform-admin
 * quarantine release flow -- both create the same kind of row and should
 * fail the same way on a sender someone else already claimed.
 */
export async function createInboundSenderRoute(params: {
  accountId: string;
  email: string;
  defaultAssignedToUserId?: string | null;
  createdByUserId: string;
  auditSource?: string;
  requestId?: string;
}) {
  const { accountId, email, defaultAssignedToUserId, createdByUserId, auditSource = "UI", requestId } = params;
  const normalizedSenderEmail = normalizeSenderEmail(email);

  const reactivateExisting = async (existing: { id: string; accountId: string; status: string }) => {
    if (existing.accountId !== accountId) throw new InboundSenderAlreadyRoutedError();

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
      where: { normalizedSenderEmail },
      select: { id: true, accountId: true, status: true },
    })
  );
  if (existing) return reactivateExisting(existing);

  try {
    const route = await db.inboundSenderRoute.create({
      data: {
        accountId,
        normalizedSenderEmail,
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
          where: { normalizedSenderEmail },
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
  email: string;
  blockedByUserId: string;
  auditSource?: string;
  requestId?: string;
}) {
  const { accountId, email, blockedByUserId, auditSource = "UI", requestId } = params;
  const normalizedSenderEmail = normalizeSenderEmail(email);

  const existing = await withDataModeContext(null, async () =>
    db.inboundSenderRoute.findUnique({ where: { normalizedSenderEmail } })
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
