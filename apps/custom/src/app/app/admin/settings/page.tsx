import { getAccountContext } from "@/lib/auth";
import { getSettingsAuditData } from "@/lib/admin/auditData";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { SettingsAuditPanel } from "./SettingsAuditPanel";
import { DocumentEmailPanel } from "./DocumentEmailPanel";
import { AgentPoliciesPanel } from "./AgentPoliciesPanel";
import { ApiKeyPanel } from "./ApiKeyPanel";
import { PrivateEmbargoRulesPanel } from "./PrivateEmbargoRulesPanel";

export default async function AdminSettingsPage() {
  const context = await getAccountContext();

  if (!context) {
    return null;
  }

  // InboundSenderRoute/AccountMembership/AgentPolicyConfig/AuditLog/
  // AccountApiKey all carry an Account relation (dataMode-scoped) -- without
  // this wrapper these queries silently default to PRODUCTION isolation.
  return withDataModeContext(isDataMode(context.dataMode) ? context.dataMode : null, async () => {

  const [data, routes, memberships, agentPolicies, policyHistory, apiKeys, embargoConfig, privateEmbargoRules] = await Promise.all([
    getSettingsAuditData(context),
    db.inboundSenderRoute.findMany({
      where: { accountId: context.accountId },
      include: { defaultAssignedToUser: { select: { id: true, email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.accountMembership.findMany({
      where: { accountId: context.accountId, status: "ACTIVE" },
      include: { user: true },
    }),
    db.agentPolicyConfig.findMany({
      where: { accountId: context.accountId },
      orderBy: { agentName: "asc" },
    }),
    db.auditLog.findMany({
      where: {
        accountId: context.accountId,
        entity: "AgentPolicyConfig",
        action: { in: ["AGENT_POLICY_CREATED", "AGENT_POLICY_UPDATED"] },
      },
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.accountApiKey.findMany({
      where: { accountId: context.accountId },
      orderBy: { createdAt: "desc" },
    }),
    db.accountEmbargoConfig.findUnique({ where: { accountId: context.accountId } }),
    db.privateEmbargoRule.findMany({
      where: { accountId: context.accountId },
      orderBy: [{ status: "asc" }, { toCountryCode: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const teamMembers = memberships.map((m) => ({
    userId: m.user.id,
    email: m.user.email,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
  }));

  return (
    <div className="space-y-10">
      <DocumentEmailPanel
        publicDocumentAddress={process.env.RESEND_PUBLIC_DOCUMENT_ADDRESS ?? "docs@inbound.qubere.ai"}
        accountName={context.accountName}
        initialRoutes={routes.map((r) => ({
          id: r.id,
          displaySenderEmail: r.displaySenderEmail,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          defaultAssignedToUser: r.defaultAssignedToUser,
        }))}
        teamMembers={teamMembers}
      />
      <ApiKeyPanel
        initialKeys={apiKeys.map((k) => ({
          id: k.id,
          label: k.label,
          keyPrefix: k.keyPrefix,
          scopes: k.scopes,
          status: k.status,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
      />
      <AgentPoliciesPanel
        initialPolicies={agentPolicies.map((p) => ({
          id: p.id,
          agentName: p.agentName,
          autoThreshold: p.autoThreshold,
          confirmThreshold: p.confirmThreshold,
          requirePartMasterMatch: p.requirePartMasterMatch,
          updatedAt: p.updatedAt.toISOString(),
        }))}
        history={policyHistory.map((h) => ({
          id: h.id,
          action: h.action,
          metadata: (h.metadata ?? {}) as Record<string, unknown>,
          changedBy: h.user
            ? `${h.user.firstName ?? ""} ${h.user.lastName ?? ""}`.trim() || h.user.email
            : "System",
          createdAt: h.createdAt.toISOString(),
        }))}
      />
      <PrivateEmbargoRulesPanel
        initialEnabled={embargoConfig?.privateEmbargoEnabled ?? false}
        initialRules={privateEmbargoRules.map((r) => ({
          id: r.id,
          fromCountryCode: r.fromCountryCode,
          appliesToAllFromCountries: r.appliesToAllFromCountries,
          toCountryCode: r.toCountryCode,
          embargoed: r.embargoed,
          effectiveDate: r.effectiveDate.toISOString(),
          expirationDate: r.expirationDate ? r.expirationDate.toISOString() : null,
          reason: r.reason,
          reference: r.reference,
          status: r.status,
        }))}
      />
      <SettingsAuditPanel accountName={context.accountName} {...data} />
    </div>
  );
  });
}
