import { NextResponse } from "next/server";
import { db } from "@qubere/db";

async function resolveInvitation(token: string) {
  const invitation = await db.invitation.findFirst({
    where: {
      token,
      purpose: "CUSTOMER_PORTAL",
      status: "ACCEPTED",
    },
    select: {
      clientId: true,
      accountId: true,
      client: { select: { name: true } },
      account: { select: { name: true } },
    },
  });
  return invitation;
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await resolveInvitation(token);
  if (!invitation || !invitation.clientId) {
    return NextResponse.json({ error: "Invalid or expired onboarding link" }, { status: 404 });
  }

  const onboardingCase = await db.onboardingCase.findFirst({
    where: { accountId: invitation.accountId, clientId: invitation.clientId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      entities: {
        take: 1,
        select: {
          id: true,
          importerOfRecordId: true,
          officers: true,
          bondId: true,
          poa: {
            select: {
              id: true,
              status: true,
              envelope: { select: { providerEnvelopeId: true, status: true } },
            },
          },
          importerOfRecord: {
            select: {
              id: true,
              name: true,
              irsEin: true,
              cbpImporterNumber: true,
              address: true,
            },
          },
        },
      },
    },
  });

  if (!onboardingCase) {
    return NextResponse.json({ error: "No onboarding case found for this invitation" }, { status: 404 });
  }

  const entity = onboardingCase.entities[0];
  const ior = entity?.importerOfRecord;
  const addr = (ior?.address ?? {}) as Record<string, string>;

  return NextResponse.json({
    clientName: invitation.client?.name ?? "Your company",
    brokerName: invitation.account?.name ?? "Your broker",
    onboardingCaseId: onboardingCase.id,
    entityId: entity?.id ?? null,
    poaStatus: entity?.poa?.status ?? null,
    poaEnvelopeSignUrl: null, // envelope sign URL comes from e-sign provider, not stored here
    entityDetails: ior
      ? {
          legalName: ior.name,
          entityType: addr.entityType ?? "",
          addressLine1: addr.line1 ?? addr.addressLine1 ?? "",
          city: addr.city ?? "",
          state: addr.state ?? "",
          postalCode: addr.postalCode ?? addr.zip ?? "",
          country: addr.country ?? "US",
          ein: ior.irsEin ?? ior.cbpImporterNumber ?? "",
        }
      : null,
    officers: Array.isArray(entity?.officers) ? entity.officers : [],
  });
}
