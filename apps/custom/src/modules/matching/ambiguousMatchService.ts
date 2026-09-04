import { db } from "@/lib/db";
import { MatchProposalDomain, MatchProposalStatus, Prisma } from "@prisma/client";
import { ShipmentPartyService } from "@/modules/shipment/shipmentPartyService";
import { createParty } from "@/modules/party/partyService";
import { createProduct } from "@/modules/product/productService";

export interface RecordProposalInput {
  accountId: string;
  domain: MatchProposalDomain;
  matchStatus: string;
  targetEntityType?: string | null;
  targetEntityId?: string | null;
  targetRole?: string | null;
  sourceDocumentId?: string | null;
  source?: string;
  inputPayload: Record<string, unknown>;
  candidatesJson: unknown[];
}

export interface ProposalListQuery {
  domain?: MatchProposalDomain;
  status?: MatchProposalStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ResolveProposalInput {
  proposalId: string;
  action: "CONFIRM" | "CREATE_NEW" | "REJECT";
  selectedPartyId?: string | null;
  selectedProductId?: string | null;
  userId?: string | null;
}

export async function recordPendingMatchProposal(input: RecordProposalInput) {
  return db.pendingMatchProposal.create({
    data: {
      accountId: input.accountId,
      domain: input.domain,
      matchStatus: input.matchStatus,
      targetEntityType: input.targetEntityType ?? null,
      targetEntityId: input.targetEntityId ?? null,
      targetRole: input.targetRole ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
      source: input.source ?? "DOCUMENT",
      inputPayload: input.inputPayload as Prisma.InputJsonValue,
      candidatesJson: input.candidatesJson as Prisma.InputJsonValue,
      status: "PENDING",
    },
  });
}

export async function listPendingMatchProposals(
  actor: { accountId: string },
  query?: ProposalListQuery
) {
  const page = Math.max(1, query?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query?.pageSize ?? 20));
  const skip = (page - 1) * pageSize;

  const where: Prisma.PendingMatchProposalWhereInput = {
    accountId: actor.accountId,
    ...(query?.domain ? { domain: query.domain } : {}),
    ...(query?.status ? { status: query.status } : { status: "PENDING" }),
  };

  const [rows, total] = await Promise.all([
    db.pendingMatchProposal.findMany({
      where,
      include: {
        sourceDocument: { select: { id: true, fileName: true, shipmentId: true } },
        resolvedParty: { select: { id: true, internalPartyCode: true } },
        resolvedProduct: { select: { id: true, productName: true, internalSku: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.pendingMatchProposal.count({ where }),
  ]);

  return { rows, total, page, pageSize };
}

export async function resolveMatchProposal(
  actor: { accountId: string; userId?: string | null },
  input: ResolveProposalInput
) {
  const proposal = await db.pendingMatchProposal.findFirst({
    where: { id: input.proposalId, accountId: actor.accountId },
  });

  if (!proposal) {
    throw new Error(`Proposal '${input.proposalId}' not found for account.`);
  }

  if (proposal.status !== "PENDING") {
    throw new Error(`Proposal '${input.proposalId}' is already resolved (${proposal.status}).`);
  }

  const userId = input.userId ?? actor.userId ?? null;

  if (input.action === "REJECT") {
    return db.pendingMatchProposal.update({
      where: { id: proposal.id },
      data: {
        status: "REJECTED",
        resolvedByUserId: userId,
        resolvedAt: new Date(),
      },
    });
  }

  if (proposal.domain === "PARTY") {
    let partyIdToAttach: string | null = input.selectedPartyId ?? null;

    if (input.action === "CREATE_NEW") {
      const payload = (proposal.inputPayload ?? {}) as Record<string, any>;
      const legalName = payload.legalName || payload.name || "New Party";

      const createdParty = await createParty(
        { accountId: actor.accountId, userId },
        {
          partyKind: "ORGANIZATION",
          names: [{ nameType: "LEGAL", rawName: legalName, isPrimary: true, sourceType: "USER" }],
        }
      );
      partyIdToAttach = createdParty.id;
    }

    if (!partyIdToAttach) {
      throw new Error("A partyId must be provided or created to confirm this proposal.");
    }

    // Write evidence row for provenance
    await db.partyEvidence.create({
      data: {
        accountId: actor.accountId,
        partyId: partyIdToAttach,
        sourceType: "USER",
        sourceDocumentId: proposal.sourceDocumentId ?? null,
        description: `Confirmed via ambiguous match review for proposal ${proposal.id}`,
        createdByUserId: userId,
      },
    });

    // Deferred attachment if target is a ShipmentParty
    if (proposal.targetEntityType === "SHIPMENT_PARTY" && proposal.targetEntityId && proposal.targetRole) {
      const legalEntity = await db.legalEntity.findFirst({
        where: { partyId: partyIdToAttach, accountId: actor.accountId },
      });

      let legalEntityId = legalEntity?.id;
      if (!legalEntityId) {
        const party = await db.party.findUnique({ where: { id: partyIdToAttach } });
        const createdLe = await db.legalEntity.create({
          data: {
            accountId: actor.accountId,
            legalName: party?.internalPartyCode ?? "Linked Legal Entity",
            country: "US",
            status: "ACTIVE",
            partyId: partyIdToAttach,
          },
        });
        legalEntityId = createdLe.id;
      }

      await ShipmentPartyService.assignParty({
        shipmentId: proposal.targetEntityId,
        legalEntityId,
        role: proposal.targetRole as any,
        accountId: actor.accountId,
        source: "USER",
        isVerified: true,
      });
    }

    return db.pendingMatchProposal.update({
      where: { id: proposal.id },
      data: {
        status: input.action === "CREATE_NEW" ? "CREATED_NEW" : "CONFIRMED",
        resolvedPartyId: partyIdToAttach,
        resolvedByUserId: userId,
        resolvedAt: new Date(),
      },
    });
  }

  // PRODUCT domain
  let productIdToAttach: string | null = input.selectedProductId ?? null;

  if (input.action === "CREATE_NEW") {
    const payload = (proposal.inputPayload ?? {}) as Record<string, any>;
    const productName = payload.productName || payload.description || "New Product";

    const createdProduct = await createProduct(
      { accountId: actor.accountId, userId },
      {
        productName,
        status: "ACTIVE",
      }
    );
    productIdToAttach = createdProduct.id;
  }

  if (!productIdToAttach) {
    throw new Error("A productId must be provided or created to confirm this proposal.");
  }

  // Write evidence row for product provenance
  await db.productEvidence.create({
    data: {
      accountId: actor.accountId,
      productId: productIdToAttach,
      sourceType: "USER",
      sourceDocumentId: proposal.sourceDocumentId ?? null,
      description: `Confirmed via ambiguous match review for proposal ${proposal.id}`,
      createdByUserId: userId,
    },
  });

  // Deferred attachment if target is a ShipmentLineItem
  if (proposal.targetEntityType === "SHIPMENT_LINE_ITEM" && proposal.targetEntityId) {
    await db.shipmentLineItem.updateMany({
      where: { id: proposal.targetEntityId, accountId: actor.accountId },
      data: {
        productId: productIdToAttach,
        productMatchStatus: "EXACT_MATCH",
        productMatchedAt: new Date(),
      },
    });
  }

  return db.pendingMatchProposal.update({
    where: { id: proposal.id },
    data: {
      status: input.action === "CREATE_NEW" ? "CREATED_NEW" : "CONFIRMED",
      resolvedProductId: productIdToAttach,
      resolvedByUserId: userId,
      resolvedAt: new Date(),
    },
  });
}
