/**
 * Generates a portable, data-only SQL dump of the "ABC Customs Brokers"
 * billing demo (account cmt912x420000fx0pk541dnji) so it can be seeded into
 * a different Postgres database via plain `psql`, with no Node/Prisma needed
 * on the target side. Assumes the target already has the Prisma schema
 * (migrations) applied -- this only inserts rows, in FK-safe parent-first
 * order, using ON CONFLICT (id) DO NOTHING so it's safe to re-run.
 *
 * Usage: npx tsx apps/custom/scripts/generate-demo-sql-dump.ts > demo-dump.sql
 * Then:  psql "$TARGET_DATABASE_URL" -f demo-dump.sql
 */
import * as dotenv from "dotenv";
dotenv.config({ path: "apps/custom/.env.local" });
import { db, withDataModeContext } from "@qubere/db";

const ACCOUNT_ID = "cmt912x420000fx0pk541dnji";
const FRANK_EMAIL = "multirole@qubere.ai";

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;
  // Prisma.Decimal and similar: has toString() giving a plain numeric string
  if (typeof value === "object" && value !== null && typeof (value as { toString?: unknown }).toString === "function" && (value as { constructor?: { name?: string } }).constructor?.name === "Decimal") {
    return (value as { toString(): string }).toString();
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'";
    return `ARRAY[${value.map((v) => sqlLiteral(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function insertStatement(table: string, rows: Record<string, unknown>[], conflictKeys: string[] = ["id"]): string {
  if (rows.length === 0) return `-- (no rows for "${table}")\n`;
  const columns = Object.keys(rows[0]);
  const lines = rows.map(
    (row) => `(${columns.map((c) => sqlLiteral(row[c])).join(", ")})`
  );
  return (
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")})\n` +
    `VALUES\n  ${lines.join(",\n  ")}\n` +
    `ON CONFLICT (${conflictKeys.map((c) => `"${c}"`).join(", ")}) DO NOTHING;\n`
  );
}

async function main() {
  await withDataModeContext("DEMO", async () => {
    const out: string[] = [];
    out.push("-- Qubere billing demo data dump: ABC Customs Brokers");
    out.push(`-- Generated ${new Date().toISOString()}`);
    out.push("BEGIN;");
    out.push("");

    // 1. Account
    const account = await db.account.findUniqueOrThrow({ where: { id: ACCOUNT_ID } });
    out.push(insertStatement("Account", [account as unknown as Record<string, unknown>]));

    // 2. Frank + the three demo actor users referenced by createdBy/assignedBroker fields
    const users = await db.user.findMany({
      where: {
        OR: [
          { email: FRANK_EMAIL },
          { memberships: { some: { accountId: ACCOUNT_ID } } },
          { assignedShipments: { some: { accountId: ACCOUNT_ID } } },
        ],
      },
    });
    out.push(insertStatement("User", users as unknown as Record<string, unknown>[]));

    // 3. System OWNER role (global, accountId null) -- upsert-safe, likely already exists on target
    const ownerRole = await db.role.findFirst({ where: { isSystem: true, name: "OWNER" } });
    if (ownerRole) out.push(insertStatement("Role", [ownerRole as unknown as Record<string, unknown>]));

    // 4. Frank's membership + role + entitlements on this account
    const frank = users.find((u) => u.email === FRANK_EMAIL);
    if (frank) {
      const membership = await db.accountMembership.findUnique({
        where: { accountId_userId: { accountId: ACCOUNT_ID, userId: frank.id } },
      });
      if (membership) {
        out.push(insertStatement("AccountMembership", [membership as unknown as Record<string, unknown>]));
        if (ownerRole) {
          const membershipRole = await db.accountMembershipRole.findUnique({
            where: { accountMembershipId_roleId: { accountMembershipId: membership.id, roleId: ownerRole.id } },
          });
          if (membershipRole) out.push(insertStatement("AccountMembershipRole", [membershipRole as unknown as Record<string, unknown>]));
        }
      }
    }
    const entitlements = await db.accountProductEntitlement.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("AccountProductEntitlement", entitlements as unknown as Record<string, unknown>[]));

    // 5. Clients
    const clients = await db.client.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("Client", clients as unknown as Record<string, unknown>[]));

    // 6. Cost profile
    const costProfiles = await db.costProfile.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("CostProfile", costProfiles as unknown as Record<string, unknown>[]));

    // 7. Billing event catalog
    const eventDefs = await db.billingEventDefinition.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("BillingEventDefinition", eventDefs as unknown as Record<string, unknown>[]));

    // 8. Rate cards -> versions -> rules -> capability mappings
    const rateCards = await db.rateCard.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("RateCard", rateCards as unknown as Record<string, unknown>[]));

    const rateCardVersions = await db.rateCardVersion.findMany({ where: { rateCardId: { in: rateCards.map((r) => r.id) } } });
    out.push(insertStatement("RateCardVersion", rateCardVersions as unknown as Record<string, unknown>[]));

    const rateRules = await db.rateRule.findMany({ where: { rateCardVersionId: { in: rateCardVersions.map((v) => v.id) } } });
    out.push(insertStatement("RateRule", rateRules as unknown as Record<string, unknown>[]));

    const capMappings = await db.rateRuleCapabilityMapping.findMany({ where: { rateRuleId: { in: rateRules.map((r) => r.id) } } });
    out.push(insertStatement("RateRuleCapabilityMapping", capMappings as unknown as Record<string, unknown>[]));

    // 9. Shipments
    const shipments = await db.shipment.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("Shipment", shipments as unknown as Record<string, unknown>[]));

    // 10. Usage events
    const usageEvents = await db.usageEvent.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("UsageEvent", usageEvents as unknown as Record<string, unknown>[]));

    // 11. Shipment charges + costs
    const charges = await db.shipmentCharge.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("ShipmentCharge", charges as unknown as Record<string, unknown>[]));

    const costs = await db.shipmentCost.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("ShipmentCost", costs as unknown as Record<string, unknown>[]));

    // 12. Charge adjustments
    const adjustments = await db.chargeAdjustment.findMany({ where: { charge: { accountId: ACCOUNT_ID } } });
    out.push(insertStatement("ChargeAdjustment", adjustments as unknown as Record<string, unknown>[]));

    // 13. Invoices + lines + payments
    const invoices = await db.invoice.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("Invoice", invoices as unknown as Record<string, unknown>[]));

    const invoiceLines = await db.invoiceLine.findMany({ where: { invoiceId: { in: invoices.map((i) => i.id) } } });
    out.push(insertStatement("InvoiceLine", invoiceLines as unknown as Record<string, unknown>[]));

    const payments = await db.payment.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("Payment", payments as unknown as Record<string, unknown>[]));

    // 14. Billing exceptions
    const exceptions = await db.billingException.findMany({ where: { accountId: ACCOUNT_ID } });
    out.push(insertStatement("BillingException", exceptions as unknown as Record<string, unknown>[]));

    out.push("COMMIT;");

    console.log(out.join("\n"));
  });
}

main()
  .catch((e) => {
    console.error("Dump generation failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
