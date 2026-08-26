import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuthenticatedRoute } from "@/lib/api/auth-guards";
import { parseAndValidateBody } from "@/lib/api/validation";
import { createAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { resolveCountry } from "@/modules/agents/compliance/embargo/embargoRepository";
import {
  listPrivateEmbargoRules,
  createPrivateEmbargoRule,
  findOverlappingActivePrivateEmbargoRule,
  type PrivateEmbargoRuleInput,
} from "@/modules/agents/compliance/embargo/privateEmbargoRuleRepository";

function serializeRule(rule: Awaited<ReturnType<typeof listPrivateEmbargoRules>>[number]) {
  return {
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
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export const GET = withAuthenticatedRoute(async ({ ctx, requestId }) => {
  const [config, rules] = await Promise.all([
    db.accountEmbargoConfig.findUnique({ where: { accountId: ctx.accountId } }),
    listPrivateEmbargoRules(ctx.accountId),
  ]);

  return NextResponse.json({
    privateEmbargoEnabled: config?.privateEmbargoEnabled ?? false,
    rules: rules.map(serializeRule),
    requestId,
  });
}, { permission: "settings.manage" });

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

export const POST = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
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

  const conflict = await findOverlappingActivePrivateEmbargoRule(ctx.accountId, input);
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

  const rule = await createPrivateEmbargoRule(ctx.accountId, ctx.userId, input);

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "PRIVATE_EMBARGO_RULE_CREATED",
    entity: "PrivateEmbargoRule",
    entityId: rule.id,
    source: "UI",
    metadata: { toCountryCode: rule.toCountryCode, fromCountryCode: rule.fromCountryCode, appliesToAllFromCountries: rule.appliesToAllFromCountries },
    success: true,
  });

  return NextResponse.json({ success: true, rule: serializeRule(rule), requestId });
}, { permission: "settings.manage", write: true });

const toggleSchema = z.object({ privateEmbargoEnabled: z.boolean() });

export const PATCH = withAuthenticatedRoute(async ({ req, ctx, requestId }) => {
  const bodyVal = await parseAndValidateBody(req, toggleSchema, requestId);
  if ("response" in bodyVal) return bodyVal.response;
  const { privateEmbargoEnabled } = bodyVal.data;

  const config = await db.accountEmbargoConfig.upsert({
    where: { accountId: ctx.accountId },
    update: { privateEmbargoEnabled },
    create: { accountId: ctx.accountId, privateEmbargoEnabled },
  });

  await createAuditLog({
    accountId: ctx.accountId,
    userId: ctx.userId,
    action: "PRIVATE_EMBARGO_SCREENING_TOGGLED",
    entity: "AccountEmbargoConfig",
    entityId: config.id,
    source: "UI",
    metadata: { privateEmbargoEnabled },
    success: true,
  });

  return NextResponse.json({ success: true, privateEmbargoEnabled: config.privateEmbargoEnabled, requestId });
}, { permission: "settings.manage", write: true });
