import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody } from "@/lib/api/validation";
import { createAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { resolveCountry } from "@/modules/agents/compliance/embargo/embargoRepository";
import {
  findOverlappingActivePrivateEmbargoRule,
  updatePrivateEmbargoRule,
  disablePrivateEmbargoRule,
  type PrivateEmbargoRuleInput,
} from "@/modules/agents/compliance/embargo/privateEmbargoRuleRepository";

const ruleSchema = z
  .object({
    fromCountryCode: z.string().trim().min(1).max(10).nullable().optional(),
    appliesToAllFromCountries: z.boolean().default(false),
    toCountryCode: z.string().trim().min(1).max(10),
    embargoed: z.boolean().default(true),
    effectiveDate: z.coerce.date(),
    expirationDate: z.coerce.date().nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
    reference: z.string().trim().max(200).nullable().optional(),
  })
  .refine((d) => d.appliesToAllFromCountries || !!d.fromCountryCode, {
    message: "fromCountryCode is required unless appliesToAllFromCountries is true",
    path: ["fromCountryCode"],
  })
  .refine((d) => !d.appliesToAllFromCountries || !d.fromCountryCode, {
    message: "fromCountryCode must not be set when appliesToAllFromCountries is true",
    path: ["fromCountryCode"],
  })
  .refine((d) => !d.expirationDate || d.expirationDate >= d.effectiveDate, {
    message: "expirationDate must be on or after effectiveDate",
    path: ["expirationDate"],
  });

export const PATCH = withAuthenticatedRoute<{ id: string }>(async ({ req, ctx, params, requestId }) => {
  const { id } = params;

  // Ownership check up front -- never trust the route param alone (tenant isolation).
  const existing = await db.privateEmbargoRule.findFirst({ where: { id, accountId: ctx.accountId } });
  if (!existing) {
    return NextResponse.json({ error: "Private embargo rule not found", requestId }, { status: 404 });
  }

  const bodyVal = await parseAndValidateBody(req, ruleSchema, requestId);
  if ("response" in bodyVal) return bodyVal.response;
  const data = bodyVal.data;

  const toCountry = await resolveCountry(data.toCountryCode);
  if (!toCountry) {
    return NextResponse.json({ error: `Unknown destination country code "${data.toCountryCode}"`, requestId }, { status: 400 });
  }
  if (!data.appliesToAllFromCountries && data.fromCountryCode) {
    const fromCountry = await resolveCountry(data.fromCountryCode);
    if (!fromCountry) {
      return NextResponse.json({ error: `Unknown source country code "${data.fromCountryCode}"`, requestId }, { status: 400 });
    }
  }

  const input: PrivateEmbargoRuleInput = {
    fromCountryCode: data.appliesToAllFromCountries ? null : data.fromCountryCode ?? null,
    appliesToAllFromCountries: data.appliesToAllFromCountries,
    toCountryCode: data.toCountryCode,
    embargoed: data.embargoed,
    effectiveDate: data.effectiveDate,
    expirationDate: data.expirationDate ?? null,
    reason: data.reason ?? null,
    reference: data.reference ?? null,
  };

  const conflict = await findOverlappingActivePrivateEmbargoRule(ctx.accountId, input, id);
  if (conflict) {
    return NextResponse.json(
      {
        error: "This rule overlaps an existing active rule for the same account, source-country scope, destination country, and effective period.",
        conflictingRuleId: conflict.id,
        requestId,
      },
      { status: 409 }
    );
  }

  const rule = await updatePrivateEmbargoRule(id, ctx.accountId, ctx.userId, input);

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "PRIVATE_EMBARGO_RULE_UPDATED",
    entity: "PrivateEmbargoRule",
    entityId: rule.id,
    source: "UI",
    metadata: { before: existing, after: input },
    success: true,
  });

  return NextResponse.json({
    success: true,
    rule: {
      id: rule.id,
      fromCountryCode: rule.fromCountryCode,
      appliesToAllFromCountries: rule.appliesToAllFromCountries,
      toCountryCode: rule.toCountryCode,
      embargoed: rule.embargoed,
      effectiveDate: rule.effectiveDate.toISOString(),
      expirationDate: rule.expirationDate ? rule.expirationDate.toISOString() : null,
      reason: rule.reason,
      reference: rule.reference,
      status: rule.status,
      updatedAt: rule.updatedAt.toISOString(),
    },
    requestId,
  });
}, { permission: "settings.manage", write: true });

export const DELETE = withAuthenticatedRoute<{ id: string }>(async ({ ctx, params, requestId }) => {
  const { id } = params;

  const existing = await db.privateEmbargoRule.findFirst({ where: { id, accountId: ctx.accountId } });
  if (!existing) {
    return NextResponse.json({ error: "Private embargo rule not found", requestId }, { status: 404 });
  }

  const rule = await disablePrivateEmbargoRule(id, ctx.accountId, ctx.userId);

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "PRIVATE_EMBARGO_RULE_DISABLED",
    entity: "PrivateEmbargoRule",
    entityId: rule.id,
    source: "UI",
    metadata: { toCountryCode: rule.toCountryCode, fromCountryCode: rule.fromCountryCode },
    success: true,
  });

  return NextResponse.json({ success: true, requestId });
}, { permission: "settings.manage", write: true });
