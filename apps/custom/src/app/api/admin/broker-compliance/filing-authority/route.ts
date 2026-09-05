// Filing-authority check: validates the broker's filer code and district permit
// coverage before the first filing for a given importer district.

import { NextResponse } from "next/server";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { db } from "@/lib/db";

export const GET = withAuthenticatedRoute(
  async ({ req, ctx, requestId }) => {
    const { searchParams } = new URL(req.url);
    const districtCode = searchParams.get("districtCode");

    const profile = await db.brokerComplianceProfile.findUnique({
      where: { accountId: ctx.accountId },
      include: { districtPermits: true, permitQualifyingOfficers: true },
    });

    if (!profile) {
      return NextResponse.json({
        authorized: false,
        reason: "no_profile",
        message: "Broker compliance profile not configured.",
        requestId,
      });
    }

    const checks: Array<{ key: string; pass: boolean; message: string }> = [];

    // 1 — Filer code on file
    checks.push({
      key: "filer_code",
      pass: !!(profile.filerCode?.trim()),
      message: profile.filerCode?.trim() ? `Filer code: ${profile.filerCode}` : "No CBP filer code on record.",
    });

    // 2 — National permit active (or district permit covers this district)
    const nationalOk = profile.nationalPermitStatus === "active";
    const districtOk = districtCode
      ? profile.districtPermits.some((p) => p.districtCode === districtCode && p.status === "active")
      : false;

    checks.push({
      key: "permit",
      pass: nationalOk || districtOk,
      message: nationalOk
        ? `National permit active (${profile.nationalPermitNumber ?? "no number"}).`
        : districtOk
        ? `District permit for ${districtCode} is active.`
        : districtCode
        ? `No active permit for district ${districtCode} — national permit status: ${profile.nationalPermitStatus}.`
        : "No active national permit.",
    });

    // 3 — At least one active PQO
    const activePqo = profile.permitQualifyingOfficers.some((p) => p.active);
    checks.push({
      key: "pqo",
      pass: activePqo,
      message: activePqo
        ? `${profile.permitQualifyingOfficers.filter((p) => p.active).length} active PQO(s) on file.`
        : "No active Permit-Qualifying Officer on file.",
    });

    // 4 — License present
    checks.push({
      key: "license",
      pass: !!(profile.brokerLicenseNumber?.trim()),
      message: profile.brokerLicenseNumber ? `License: ${profile.brokerLicenseNumber}` : "No customs broker license number recorded.",
    });

    const authorized = checks.every((c) => c.pass);

    return NextResponse.json({ authorized, checks, profile: { status: profile.status }, requestId });
  },
  { permission: "broker_compliance.manage" }
);
