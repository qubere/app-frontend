/**
 * scripts/setup-multirole-user.ts
 *
 * Provisions and configures multirole@qubere.ai for demo-app presentation:
 * - Grants PLATFORM_ADMIN platform user role (100% permission bypass + impersonation rights)
 * - Provisions ACTIVE AccountMembership with OWNER role across ALL accounts in Qubere
 * - Provisions ACTIVE CUSTOMS and TMS product entitlements across all accounts
 * - Unlocks User Management, Impersonation, Customer Onboarding, and Client Onboarding capabilities
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = (process.env.TARGET_EMAIL || "multirole@qubere.ai").toLowerCase();
  console.log(`🚀 Setting up ${email} for demo-app multi-role & impersonation presentation...`);

  // 1. Upsert User record
  let user = await db.user.findFirst({
    where: { email: email.toLowerCase(), deletedAt: null },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        firstName: "Frank",
        lastName: "MultiAccountUser",
        clerkUserId: "demo_qubere_multirole",
      },
    });
    console.log(`✓ Created DB user record for "${email}" (ID: ${user.id}).`);
  } else {
    console.log(`✓ Found existing DB user record for "${email}" (ID: ${user.id}).`);
  }

  // 2. Grant PLATFORM_ADMIN Platform User Role
  let platformAdminRole = await db.platformRole.findUnique({
    where: { name: "PLATFORM_ADMIN" },
  });
  if (!platformAdminRole) {
    platformAdminRole = await db.platformRole.create({
      data: { name: "PLATFORM_ADMIN", description: "Full Qubere platform admin" },
    });
    console.log("✓ Created PLATFORM_ADMIN platform role.");
  }

  const existingPlatformUserRole = await db.platformUserRole.findFirst({
    where: { userId: user.id, platformRoleId: platformAdminRole.id },
  });

  if (!existingPlatformUserRole) {
    await db.platformUserRole.create({
      data: { userId: user.id, platformRoleId: platformAdminRole.id },
    });
    console.log(`✓ Granted PLATFORM_ADMIN platform user role to "${email}".`);
  } else {
    console.log(`✓ "${email}" already has PLATFORM_ADMIN platform user role.`);
  }

  // 3. Ensure System Roles exist
  let ownerRole = await db.role.findFirst({ where: { isSystem: true, name: "OWNER" } });
  if (!ownerRole) {
    ownerRole = await db.role.create({
      data: { name: "OWNER", description: "System Role OWNER", isSystem: true, accountId: null },
    });
    console.log("✓ Created system OWNER role.");
  }

  // 4. Attach ACTIVE AccountMembership & OWNER role across ALL accounts
  const allAccounts = await db.account.findMany({
    where: { deletedAt: null },
  });

  console.log(`Found ${allAccounts.length} accounts in Qubere database.`);

  for (const account of allAccounts) {
    // Upsert active membership
    const membership = await db.accountMembership.upsert({
      where: { accountId_userId: { accountId: account.id, userId: user.id } },
      update: { status: "ACTIVE", deletedAt: null },
      create: { accountId: account.id, userId: user.id, status: "ACTIVE" },
    });

    // Attach OWNER role to membership
    if (ownerRole) {
      await db.accountMembershipRole.upsert({
        where: { accountMembershipId_roleId: { accountMembershipId: membership.id, roleId: ownerRole.id } },
        update: {},
        create: { accountMembershipId: membership.id, roleId: ownerRole.id },
      });
    }

    // Provision Product Entitlements
    for (const prod of ["CUSTOMS", "TMS"]) {
      await db.accountProductEntitlement.upsert({
        where: { accountId_product: { accountId: account.id, product: prod } },
        update: { status: "ACTIVE" },
        create: { accountId: account.id, product: prod, status: "ACTIVE" },
      });
    }

    console.log(`  ✓ Linked OWNER membership & product entitlements on account "${account.name}" (${account.id})`);
  }

  console.log(`\n🎉 Setup complete! "${email}" is fully configured for demo-app presentation:`);
  console.log(`  - Permissions: ALL permissions granted (Platform Admin + OWNER bypass)`);
  console.log(`  - Account Access: Linked to ALL ${allAccounts.length} accounts in Qubere`);
  console.log(`  - Impersonation: Full access to /platform-admin & impersonation session endpoints`);
  console.log(`  - Showcase Capabilities: User Management (/admin/users), Customer Onboarding (/platform-admin), Client Onboarding (/app/clients)`);
}

main()
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
