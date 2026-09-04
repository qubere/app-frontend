import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db, generateCustomsCaseNumber } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { computeReadinessScore } from "@/lib/shipmentReadiness";
import { generateShipmentNumber } from "@/modules/shipments/shipmentNumber";
import { ENTRY_TYPE_CODES, normalizeEntryType } from "@/modules/filing/entryType";
import { COUNTRY_CODES, normalizeCountryCode } from "@/modules/shipment/countryCode";
import { MANUAL_INTAKE_INITIAL_STATUS } from "@/modules/shipments/shipmentStatus";

const createShipmentSchema = z.object({
  importerOfRecordId: z.string().trim().min(1, "Choose an importer of record"),
  // Older callers may still send this field. Filing identity always comes from
  // the selected importer record, so free text can never override it.
  importerName: z.string().trim().max(200).optional(),
  poReference: z.string().trim().max(100).optional(),
  entryType: z.string().trim().max(100).optional(),
  incoterm: z.string().trim().max(100).optional(),
  portOfEntry: z.string().trim().max(200).optional(),
  carrierName: z.string().trim().max(200).optional(),
  countryOfExport: z.string().trim().max(100).optional(),
  destinationCountry: z.string().trim().max(100).optional(),
  estimatedArrival: z.coerce.date().optional(),
  masterShipmentId: z.string().trim().min(1).optional(),
  clientId: z.string().trim().min(1).optional(),
});

const LIST_PAGE_SIZE_DEFAULT = 50;
const LIST_PAGE_SIZE_MAX = 100;

function listPageSize(raw: string | null): number {
  if (raw === null) return LIST_PAGE_SIZE_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return LIST_PAGE_SIZE_DEFAULT;
  return Math.min(parsed, LIST_PAGE_SIZE_MAX);
}

function listPage(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const params = new URL(req.url).searchParams;
  const search = params.get("q")?.trim() ?? "";
  const summaryOnly = params.get("view") === "summary";
  const tab = params.get("tab")?.trim().toLowerCase();
  const pageSize = listPageSize(params.get("pageSize"));
  const page = listPage(params.get("page"));

  const whereClause: Prisma.ShipmentWhereInput = { accountId: ctx.accountId, deletedAt: null };

  // Filter based on product workspace activation (Bug 6 & 11)
  if (tab === "available_from_tms") {
    whereClause.productWorkspaces = {
      some: {
        product: "TMS",
        status: "ACTIVE",
      },
      none: {
        product: "CUSTOMS",
        status: "ACTIVE",
      },
    };
  } else {
    whereClause.productWorkspaces = {
      some: {
        product: "CUSTOMS",
        status: "ACTIVE",
      },
    };
  }

  // RLS: Planners can only see shipments assigned to them
  if (ctx.roleNames.includes("PLANNER")) {
    whereClause.assignedBrokerId = ctx.userId;
  }

  if (search) {
    const searchCondition = [
      { shipmentNumber: { contains: search, mode: "insensitive" as const } },
      { importerName: { contains: search, mode: "insensitive" as const } },
    ];
    if (whereClause.OR) {
      whereClause.AND = [{ OR: whereClause.OR }, { OR: searchCondition }];
      delete whereClause.OR;
    } else {
      whereClause.OR = searchCondition;
    }
  }

  const listArgs = {
    where: whereClause,
    orderBy: { createdAt: "desc" as const },
    skip: (page - 1) * pageSize,
    take: pageSize,
  };

  const total = await db.shipment.count({ where: whereClause });

  if (summaryOnly) {
    const shipments = await db.shipment.findMany({
      ...listArgs,
      select: { id: true, shipmentNumber: true, importerName: true, status: true },
    });
    return NextResponse.json({ shipments, total, page, pageSize });
  }

  const shipments = await db.shipment.findMany({
    ...listArgs,
    include: {
      documents: true,
      lineItems: true,
      agentDecisions: { omit: { triageState: true, blockedReason: true, autoApprovalPolicy: true } },
      customsFilings: true,
      assignedBroker: true,
      masterShipment: true,
      houseShipments: true,
      exceptionItems: { omit: { resolutionReasonCode: true } },
      client: true,
      productWorkspaces: true,
      customsCaseLinks: {
        include: {
          customsCase: true,
        },
      },
    },
  });

  const shipmentsWithReadiness = shipments.map((s) => ({
    ...s,
    readinessScore: computeReadinessScore(s),
  }));

  return NextResponse.json({ shipments: shipmentsWithReadiness, total, page, pageSize });
});

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const parsed = createShipmentSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "ValidationError",
        fieldErrors: z.flattenError(parsed.error).fieldErrors,
        requestId,
      },
      { status: 400 }
    );
  }

  const input = parsed.data;

  let entryTypeCode: string | null = null;
  if (input.entryType) {
    entryTypeCode = normalizeEntryType(input.entryType);
    if (!entryTypeCode) {
      return NextResponse.json(
        {
          error: "ValidationError",
          fieldErrors: {
            entryType: [
              `"${input.entryType}" is not a CBP entry type. Use one of: ${ENTRY_TYPE_CODES.join(", ")}.`,
            ],
          },
          requestId,
        },
        { status: 400 }
      );
    }
  }

  let destinationCountryCode: string | null = null;
  if (input.destinationCountry) {
    destinationCountryCode = normalizeCountryCode(input.destinationCountry);
    if (!destinationCountryCode) {
      return NextResponse.json(
        {
          error: "ValidationError",
          fieldErrors: {
            destinationCountry: [
              `"${input.destinationCountry}" is not a recognized country. Use an ISO 3166-1 alpha-2 code (e.g. "${COUNTRY_CODES[0]}") or a full country name.`,
            ],
          },
          requestId,
        },
        { status: 400 }
      );
    }
  }

  if (input.masterShipmentId) {
    const master = await db.shipment.findFirst({
      where: { id: input.masterShipmentId, accountId: ctx.accountId },
      select: { id: true },
    });
    if (!master) {
      return NextResponse.json({ error: "Invalid masterShipmentId: Master shipment not found in this account" });
    }
  }

  const importer = await db.importerOfRecord.findFirst({
    where: { id: input.importerOfRecordId, accountId: ctx.accountId },
    select: { id: true, name: true, clientId: true },
  });
  if (!importer) {
    return NextResponse.json({
      error: "ValidationError",
      fieldErrors: { importerOfRecordId: ["Importer not found in this broker account."] },
      requestId,
    }, { status: 400 });
  }
  if (!importer.clientId) {
    return NextResponse.json({
      error: "ValidationError",
      fieldErrors: { importerOfRecordId: ["Assign this importer to a client before creating a shipment."] },
      requestId,
    }, { status: 400 });
  }
  if (!ctx.isAllClients && !ctx.authorizedClientIds.includes(importer.clientId)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Importer is outside your authorized client scope." }, requestId }, { status: 403 });
  }
  if (input.clientId && input.clientId !== importer.clientId) {
    return NextResponse.json({
      error: { code: "CLIENT_IMPORTER_MISMATCH", message: "The selected client does not own this importer. Client is derived from the importer selection." },
      fieldErrors: { clientId: ["Client does not match the selected importer."] },
      requestId,
    }, { status: 400 });
  }

  const auditSource = req.headers?.get?.("x-qubere-source") === "CHAT" ? "CHAT" : "UI";

  const shipmentNumber = await generateShipmentNumber(db, ctx.accountId);

  const shipment = await db.$transaction(async (tx) => {
    const caseNumber = await generateCustomsCaseNumber(tx, ctx.accountId);
    const shp = await tx.shipment.create({
      data: {
        accountId: ctx.accountId,
        shipmentNumber,
        importerName: importer.name,
        importerOfRecordId: importer.id,
        poReference: input.poReference,
        entryType: entryTypeCode,
        incoterm: input.incoterm,
        portOfEntry: input.portOfEntry,
        carrierName: input.carrierName,
        countryOfExport: input.countryOfExport,
        destinationCountry: destinationCountryCode,
        estimatedArrival: input.estimatedArrival,
        status: MANUAL_INTAKE_INITIAL_STATUS,
        ownerName: [ctx.firstName, ctx.lastName].filter(Boolean).join(" ") || null,
        assignedBrokerId: ctx.roleNames.includes("PLANNER") ? ctx.userId : null,
        masterShipmentId: input.masterShipmentId || null,
        clientId: importer.clientId,
        customsRequired: true,
        productWorkspaces: {
          create: {
            accountId: ctx.accountId,
            product: "CUSTOMS",
            status: "ACTIVE",
            source: "CUSTOMS_INTAKE",
            activatedByUserId: ctx.userId,
          },
        },
      },
    });

    const cCase = await tx.customsCase.create({
      data: {
        accountId: ctx.accountId,
        caseNumber,
        status: "OPEN",
        entryType: entryTypeCode,
        destinationCountry: destinationCountryCode,
        assignedBrokerId: ctx.roleNames.includes("PLANNER") ? ctx.userId : null,
        copiedFromShipmentId: shp.id,
        copiedAtVersion: shp.version,
      },
    });

    await tx.customsCaseShipment.create({
      data: {
        accountId: ctx.accountId,
        customsCaseId: cCase.id,
        shipmentId: shp.id,
      },
    });

    return shp;
  });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "shipment.create",
    entity: "Shipment",
    entityId: shipment.id,
    source: auditSource,
    metadata: { shipmentNumber, importerOfRecordId: importer.id, clientId: importer.clientId, masterShipmentId: input.masterShipmentId ?? null },
  });

  return NextResponse.json({ shipment, requestId }, { status: 201 });

}, { permission: "shipments.create", write: true });
