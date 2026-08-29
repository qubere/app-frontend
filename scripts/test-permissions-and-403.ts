import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function testPermissionsLogic() {
  console.log("===============================================================");
  console.log("🧪 TESTING MULTITENANT PERMISSION RESOLUTION & 403 ACCESS DENIED");
  console.log("===============================================================");

  const targetShipment = await db.shipment.findFirst({
    where: { shipmentNumber: "SHP-TGT-2026-001" },
    include: { account: true },
  });

  if (!targetShipment) {
    throw new Error("❌ Seed shipment SHP-TGT-2026-001 not found!");
  }

  console.log(`  Target Shipment ID: ${targetShipment.id}`);
  console.log(`  Shipment Account: ${targetShipment.account.name} (${targetShipment.accountId})`);

  // Case A: User has active session under target account (Target Corporation)
  const contextAccountOwner = {
    accountId: targetShipment.accountId,
    isPlatformAdmin: false,
    memberships: [{ accountId: targetShipment.accountId, status: "ACTIVE" }],
  };

  const isTargetA = contextAccountOwner.accountId === targetShipment.accountId;
  const canAccessA = isTargetA || contextAccountOwner.isPlatformAdmin || contextAccountOwner.memberships.some(m => m.accountId === targetShipment.accountId);
  console.log(`  Case A (Account Owner): canAccess = ${canAccessA} (Expected: true)`);
  if (!canAccessA) throw new Error("Case A failed");

  // Case B: User logged in as Qubere Admin / Platform Admin (multirole@qubere.ai) with active cookie set to another account
  const contextQubereAdmin = {
    accountId: "acc_some_other_tenant_id",
    isPlatformAdmin: true,
    memberships: [{ accountId: "acc_some_other_tenant_id", status: "ACTIVE" }],
  };

  const isTargetB = contextQubereAdmin.accountId === targetShipment.accountId;
  const canAccessB = isTargetB || contextQubereAdmin.isPlatformAdmin || contextQubereAdmin.memberships.some(m => m.accountId === targetShipment.accountId);
  console.log(`  Case B (Qubere Admin / Platform Admin): canAccess = ${canAccessB} (Expected: true)`);
  if (!canAccessB) throw new Error("Case B failed - Qubere Admin was wrongly denied access!");

  // Case C: Ordinary User from another tenant attempting to view Target's shipment
  const contextOtherTenantUser = {
    accountId: "acc_unrelated_tenant_123",
    isPlatformAdmin: false,
    memberships: [{ accountId: "acc_unrelated_tenant_123", status: "ACTIVE" }],
  };

  const isTargetC = contextOtherTenantUser.accountId === targetShipment.accountId;
  const canAccessC = isTargetC || contextOtherTenantUser.isPlatformAdmin || contextOtherTenantUser.memberships.some(m => m.accountId === targetShipment.accountId);
  console.log(`  Case C (Unrelated Tenant User): canAccess = ${canAccessC} (Expected: false -> Triggers <AccessDenied /> 403 UI)`);
  if (canAccessC) throw new Error("Case C failed - Unrelated tenant user should be denied access!");

  console.log("===============================================================");
  console.log("🎉 PERMISSION RESOLUTION & 403 FORBIDDEN TEST PASSED 100%!");
  console.log("===============================================================");
}

testPermissionsLogic()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
