/**
 * GET /api/filing/release?country=NL&procedureCode=IMPORT&messageName=CC415A
 *
 * Resolves the active customs release for the selected filing target.
 * Priority:
 * 1. customer-specific FilingCustomerCustomsVersion mapping
 * 2. applyToAllCustomers FilingCustomerCustomsVersion mapping
 */

import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

type ReleaseSource = "customer" | "all";

function releasePayload(
  mapping: {
    countryCustomsVersion: {
      country: string;
      procedureCode: string;
      release: string;
      description: string | null;
    };
  },
  source: ReleaseSource
) {
  const version = mapping.countryCustomsVersion;
  return {
    release: version.release,
    description: version.description ?? `${version.country} · ${version.procedureCode} · ${version.release}`,
    source,
  };
}

export const GET = withAuthenticatedRoute(async ({ req, ctx }) => {
  const { searchParams } = new URL(req.url);

  const country = searchParams.get("country");
  const procedureCode = searchParams.get("procedureCode");
  const messageName = searchParams.get("messageName");

  if (!country || !procedureCode || !messageName) {
    return NextResponse.json(
      { error: "Missing required parameters: country, procedureCode, messageName" },
      { status: 400 }
    );
  }

  const procedure = await db.filingProcedureConfig.findFirst({
    where: {
      country,
      procedureCode,
      messageName,
      isActive: true,
      canCreateNewFiling: true,
    },
    select: { id: true },
  });

  if (!procedure) {
    return NextResponse.json(
      {
        error: "NO_PROCEDURE",
        message: `No active filing procedure is configured for ${country} · ${procedureCode} · ${messageName}.`,
      },
      { status: 404 }
    );
  }

  const versionWhere = {
    country,
    procedureCode,
    isActive: true,
  };

  const include = {
    countryCustomsVersion: {
      select: {
        country: true,
        procedureCode: true,
        release: true,
        description: true,
      },
    },
  };

  const customerMapping = await db.filingCustomerCustomsVersion.findFirst({
    where: {
      customerId: ctx.accountId,
      isActive: true,
      countryCustomsVersion: versionWhere,
    },
    include,
    orderBy: { createdAt: "desc" },
  });

  if (customerMapping) {
    return NextResponse.json(releasePayload(customerMapping, "customer"));
  }

  const allCustomersMapping = await db.filingCustomerCustomsVersion.findFirst({
    where: {
      applyToAllCustomers: true,
      isActive: true,
      countryCustomsVersion: versionWhere,
    },
    include,
    orderBy: { createdAt: "desc" },
  });

  if (allCustomersMapping) {
    return NextResponse.json(releasePayload(allCustomersMapping, "all"));
  }

  return NextResponse.json(
    {
      error: "NO_RELEASE",
      message:
        `No release is configured for ${country} · ${procedureCode} · ${messageName}. ` +
        "Please contact your administrator to configure a customs version for this account.",
    },
    { status: 404 }
  );
});
