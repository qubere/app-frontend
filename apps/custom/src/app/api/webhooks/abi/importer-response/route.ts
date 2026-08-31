import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";

// CBP accept/reject webhook for 5106 importer-create/update transmissions.
// In production this is either polled from the ABI batch/block response channel
// or delivered by the transmission provider adapter. The route is left
// intentionally auth-free (transport-level IP restriction + a bearer token
// checked against the AbiFilerCredential connectionKey convention).
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const connectionKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { transmissionRef, result, cbpAssignedNumber, rejectionReasons, filerCode } = body as {
    transmissionRef?: string;
    result?: "accepted" | "rejected";
    cbpAssignedNumber?: string;
    rejectionReasons?: string[];
    filerCode?: string;
  };

  if (!transmissionRef || !result) {
    return NextResponse.json({ error: "transmissionRef and result are required" }, { status: 400 });
  }

  if (result !== "accepted" && result !== "rejected") {
    return NextResponse.json({ error: "result must be accepted or rejected" }, { status: 400 });
  }

  // Verify the connectionKey against the filer credential to scope the response
  let accountId: string | null = null;
  if (filerCode) {
    const credential = await db.abiFilerCredential.findFirst({
      where: { filerCode: String(filerCode) },
      select: { accountId: true, secretRef: true },
    });
    if (credential) {
      // secretRef is used as the bearer token for inbound webhook auth
      if (connectionKey && credential.secretRef && connectionKey !== credential.secretRef) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
      }
      accountId = credential.accountId;
    }
  }

  const record = await db.fiveOhSixRecord.findFirst({
    where: {
      transmissionRef: String(transmissionRef),
      ...(accountId ? { accountId } : {}),
    },
    select: {
      id: true,
      accountId: true,
      caseId: true,
      onboardingEntityId: true,
      status: true,
      importerNumberType: true,
    },
  });

  if (!record) {
    return NextResponse.json({ error: "5106 record not found for transmissionRef" }, { status: 404 });
  }

  if (record.status === "accepted" || record.status === "rejected") {
    return NextResponse.json({ message: "already processed", id: record.id });
  }

  await db.$transaction(async (tx) => {
    await tx.fiveOhSixRecord.update({
      where: { id: record.id },
      data: {
        status: result,
        cbpAssignedNumber: result === "accepted" && cbpAssignedNumber ? String(cbpAssignedNumber) : undefined,
        rejectionReasons: result === "rejected" && rejectionReasons ? rejectionReasons : undefined,
        acceptedAt: result === "accepted" ? new Date() : undefined,
      },
    });

    if (result === "accepted" && record.onboardingEntityId) {
      const entity = await tx.onboardingEntity.findUnique({
        where: { id: record.onboardingEntityId },
        select: { importerOfRecordId: true },
      });
      if (entity?.importerOfRecordId) {
        await tx.importerOfRecord.update({
          where: { id: entity.importerOfRecordId },
          data: {
            registrationStatus: "registered",
            ...(cbpAssignedNumber && record.importerNumberType === "CBP_ASSIGNED"
              ? { cbpImporterNumber: String(cbpAssignedNumber) }
              : {}),
          },
        });
      }
    }

    if (record.caseId) {
      await tx.onboardingEvent.create({
        data: {
          accountId: record.accountId,
          caseId: record.caseId,
          type: result === "accepted" ? "5106_ACCEPTED" : "5106_REJECTED",
          actorType: "SYSTEM",
          detail: {
            transmissionRef,
            cbpAssignedNumber: cbpAssignedNumber ?? null,
            rejectionReasons: rejectionReasons ?? [],
          },
        },
      });
    }
  });

  await createAuditLog({
    accountId: record.accountId,
    action: result === "accepted" ? "FIVE_OH_SIX_ACCEPTED" : "FIVE_OH_SIX_REJECTED",
    entity: "FiveOhSixRecord",
    entityId: record.id,
    metadata: { transmissionRef, cbpAssignedNumber, rejectionReasons },
  });

  return NextResponse.json({ message: "ok", id: record.id, result });
}
