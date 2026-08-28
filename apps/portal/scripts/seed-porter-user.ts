import { PrismaClient } from "@prisma/client";
import { createClerkClient } from "@clerk/backend";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const db = new PrismaClient();
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

if (!clerkSecretKey) {
  console.error("Error: CLERK_SECRET_KEY is required in .env.local");
  process.exit(1);
}

const clerkClient = createClerkClient({ secretKey: clerkSecretKey });

async function seedPorterUser() {
  const targetEmail = process.env.SEED_PORTER_EMAIL || "porter@target.com";
  const password = process.env.SEED_PORTER_PASSWORD;
  if (!password) {
    console.error("Error: SEED_PORTER_PASSWORD is required (do not hardcode credentials).");
    process.exit(1);
  }

  console.log(`🚀 Creating Porter user (${targetEmail}) in Clerk and Database...`);

  // 1. Resolve or create account
  let account = await db.account.findFirst({
    where: {
      clients: {
        some: { name: { in: ["Target Corporation", "Amazon Import Services"] } },
      },
    },
  });

  if (!account) {
    account = await db.account.findFirst();
  }

  if (!account) {
    account = await db.account.create({
      data: {
        name: "Qubere Demo Customs & TMS Brokerage",
        slug: "demo-account",
        type: "ENTERPRISE",
        status: "ACTIVE",
      },
    });
  }

  console.log(`✅ Using Account: ${account.name} (${account.id})`);

  // 2. Resolve Target Client
  let targetClient = await db.client.findFirst({
    where: { accountId: account.id, name: "Target Corporation" },
  });

  if (!targetClient) {
    targetClient = await db.client.create({
      data: {
        accountId: account.id,
        name: "Target Corporation",
        contactName: "Porter User",
        contactEmail: targetEmail,
        paymentTermsDays: 30,
        status: "ACTIVE",
      },
    });
  }

  console.log(`✅ Using Client: ${targetClient.name} (${targetClient.id})`);

  // 3. Create or resolve Clerk User
  let clerkUserId: string = "";
  try {
    const existingList = await clerkClient.users.getUserList({ emailAddress: [targetEmail] });
    if (existingList.data.length > 0) {
      clerkUserId = existingList.data[0].id;
      console.log(`ℹ️ Found existing Clerk user for ${targetEmail}: ${clerkUserId}`);
      // Update password
      await clerkClient.users.updateUser(clerkUserId, {
        password: password,
        firstName: "Porter",
        lastName: "TargetUser",
      });
      console.log(`✅ Updated Clerk password for ${targetEmail}`);
    } else {
      const newUser = await clerkClient.users.createUser({
        emailAddress: [targetEmail],
        password: password,
        firstName: "Porter",
        lastName: "TargetUser",
        skipPasswordRequirement: false,
      });
      clerkUserId = newUser.id;
      console.log(`✅ Created new Clerk user: ${clerkUserId}`);
    }
  } catch (err: any) {
    console.error("Clerk user creation error:", err?.errors || err?.message || err);
  }

  if (!clerkUserId) {
    clerkUserId = `user_porter_target_${Date.now()}`;
  }

  // 4. Create or update User in PostgreSQL
  let user = await db.user.findFirst({
    where: { email: targetEmail },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        clerkUserId: clerkUserId,
        email: targetEmail,
        firstName: "Porter",
        lastName: "TargetUser",
      },
    });
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: { clerkUserId: clerkUserId },
    });
  }

  console.log(`✅ Database User: ${user.email} (${user.id})`);

  // 5. Ensure "porter" permission exists in DB
  const porterPerm = await db.permission.upsert({
    where: { name: "porter" },
    update: {},
    create: {
      name: "porter",
      description: "Porter View permission for Importers & Exporters",
    },
  });

  const portalAccessPerm = await db.permission.upsert({
    where: { name: "portal.access" },
    update: {},
    create: {
      name: "portal.access",
      description: "Access Qubere Customer Portal",
    },
  });

  // 6. Ensure CUSTOMER_USER role exists
  let role = await db.role.findFirst({
    where: { accountId: account.id, name: "CUSTOMER_USER" },
  });

  if (!role) {
    role = await db.role.create({
      data: {
        accountId: account.id,
        name: "CUSTOMER_USER",
        description: "Porter Customer User Role",
      },
    });
  }

  // Assign permissions to role
  await db.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: role.id,
        permissionId: porterPerm.id,
      },
    },
    update: {},
    create: {
      roleId: role.id,
      permissionId: porterPerm.id,
    },
  });

  await db.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: role.id,
        permissionId: portalAccessPerm.id,
      },
    },
    update: {},
    create: {
      roleId: role.id,
      permissionId: portalAccessPerm.id,
    },
  });

  // 7. Ensure Account Membership & MembershipRole
  let membership = await db.accountMembership.findFirst({
    where: { userId: user.id, accountId: account.id },
  });

  if (!membership) {
    membership = await db.accountMembership.create({
      data: {
        userId: user.id,
        accountId: account.id,
        status: "ACTIVE",
      },
    });
  }

  await db.accountMembershipRole.upsert({
    where: {
      accountMembershipId_roleId: {
        accountMembershipId: membership.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      accountMembershipId: membership.id,
      roleId: role.id,
    },
  });

  // 8. Assign User to Target Corporation Client Scope
  await db.userClientAssignment.upsert({
    where: {
      userId_clientId: {
        userId: user.id,
        clientId: targetClient.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      clientId: targetClient.id,
    },
  });

  console.log(`🎉 SUCCESS: User porter@target.com created and granted Porter View role for Target Corporation!`);
  console.log(`🔑 Credentials: porter@target.com / ${password}`);
}

seedPorterUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
