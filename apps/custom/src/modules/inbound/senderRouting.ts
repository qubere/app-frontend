import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
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
    const route = await db.inboundSenderRoute.findFirst({
      where: { normalizedSenderEmail: normalizedEmail, status: "ACTIVE" },
      select: { id: true, accountId: true, defaultAssignedToUserId: true },
    });
    return route;
  },
};

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
  return lookup.findActiveByNormalizedEmail(normalized);
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
      throw new InboundSenderAlreadyRoutedError();
    }
    throw error;
  }
}
