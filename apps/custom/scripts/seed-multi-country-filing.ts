/**
 * Seeds the NEW multi-country filing configuration tables with NL NCTS data.
 * This replaces the US-centric seed-canonical-messaging.ts approach.
 * 
 * Tables seeded:
 * - FilingProcedureCatalog (universal filing procedures)
 * - FilingActionCatalog (universal actions)
 * - FilingProcedureConfig (NL NCTS procedures and messages)
 * - FilingActionMessageMapping (NL NCTS action → message mapping)
 * - FilingActionConfiguration (NL NCTS action availability rules)
 * 
 * Re-runnable: every write is an upsert.
 * Run with: npx tsx scripts/seed-multi-country-filing.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["warn", "error"] });

/**
 * Seed universal filing procedures (country-agnostic categories)
 */
async function seedProcedureCatalog() {
  const procedures = [
    { procedureCode: "IMPORT" },
    { procedureCode: "EXPORT" },
    { procedureCode: "NCTS" },
    { procedureCode: "TEMP_STORAGE" },
    { procedureCode: "BONDED_WAREHOUSE" },
    { procedureCode: "TRANSIT" },
    { procedureCode: "CUSTOMS_WAREHOUSE" },
  ];

  for (const procedure of procedures) {
    await db.filingProcedureCatalog.upsert({
      where: { procedureCode: procedure.procedureCode },
      update: { isActive: true, updatedAt: new Date(), updatedBy: "system" },
      create: {
        procedureCode: procedure.procedureCode,
        isActive: true,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  console.log(`  ✓ ${procedures.length} FilingProcedureCatalog rows seeded`);
}

/**
 * Seed universal actions (country-agnostic actions)
 */
async function seedActionCatalog() {
  const actions = [
    { code: "SUBMIT" },
    { code: "AMENDMENT" },
    { code: "CANCELLATION" },
    { code: "INVALIDATION" },
    { code: "WITHDRAWAL" },
    { code: "ANTICIPATE_ARRIVAL" },
    { code: "QUERY_RESPONSE" },
    { code: "ADDITIONAL_INFO" },
    { code: "RESUBMIT" },
    { code: "STATUS_INQUIRY" },
  ];

  for (const action of actions) {
    await db.filingActionCatalog.upsert({
      where: { code: action.code },
      update: { isActive: true, updatedAt: new Date(), updatedBy: "system" },
      create: {
        code: action.code,
        isActive: true,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  console.log(`  ✓ ${actions.length} FilingActionCatalog rows seeded`);
}

/**
 * Seed NL NCTS procedure configuration
 * Lists valid messages for Netherlands NCTS procedure
 */
async function seedNlNctsProcedures() {
  // Get NCTS procedure catalog code
  const nctsType = await db.filingProcedureCatalog.findUnique({
    where: { procedureCode: "NCTS" },
  });

  if (!nctsType) {
    throw new Error("NCTS procedure catalog row not found. Run seedProcedureCatalog first.");
  }

  const procedures = [
    {
      transactionType: nctsType.procedureCode,
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE015", // Declaration
    },
    {
      transactionType: nctsType.procedureCode,
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE013", // Amendment
    },
    {
      transactionType: nctsType.procedureCode,
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE014", // Cancellation
    },
  ];

  for (const proc of procedures) {
    await db.filingProcedureConfig.upsert({
      where: {
        country_procedureCode_messageName: {
          country: proc.country,
          procedureCode: proc.procedureCode,
          messageName: proc.messageName,
        },
      },
      update: {
        transactionType: proc.transactionType,
        isActive: true,
        updatedAt: new Date(),
        updatedBy: "system",
      },
      create: {
        transactionType: proc.transactionType,
        country: proc.country,
        procedureCode: proc.procedureCode,
        messageName: proc.messageName,
        isActive: true,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  console.log(`  ✓ ${procedures.length} FilingProcedureConfig rows seeded (NL NCTS)`);
}

/**
 * Seed NL NCTS action to message mapping
 * Maps user actions to outbound message names
 */
async function seedNlNctsActionMessageMapping() {
  const mappings = [
    {
      country: "NL",
      procedureCode: "NCTS",
      action: "SUBMIT",
      messageName: "IE015", // Submit sends IE015 Declaration
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      action: "AMENDMENT",
      messageName: "IE013", // Amendment sends IE013
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      action: "CANCELLATION",
      messageName: "IE014", // Cancellation sends IE014
    },
  ];

  for (const mapping of mappings) {
    await db.filingActionMessageMapping.upsert({
      where: {
        country_procedureCode_action: {
          country: mapping.country,
          procedureCode: mapping.procedureCode,
          action: mapping.action,
        },
      },
      update: {
        messageName: mapping.messageName,
        isActive: true,
        updatedAt: new Date(),
        updatedBy: "system",
      },
      create: {
        country: mapping.country,
        procedureCode: mapping.procedureCode,
        action: mapping.action,
        messageName: mapping.messageName,
        isActive: true,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  console.log(`  ✓ ${mappings.length} FilingActionMessageMapping rows seeded (NL NCTS)`);
}

/**
 * Seed NL NCTS action availability rules
 * Determines which actions are available based on request message sent and response status received
 */
async function seedNlNctsActionConfiguration() {
  const configurations = [
    // ========================================
    // IE015 (Declaration) Lifecycle
    // ========================================
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE015", // Request message sent
      status: "TRANSMITTED", // Before response received
      availableActions: ["CANCELLATION"],
      allowSubmit: false,
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE015",
      status: "ACCEPTED", // Positive response (IE028)
      availableActions: ["AMENDMENT", "CANCELLATION"],
      allowSubmit: false,
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE015",
      status: "REJECTED", // Negative response (IE056)
      availableActions: ["CANCELLATION"],
      allowSubmit: true, // Can resubmit after fixing errors
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE015",
      status: "PENDING", // Awaiting customs review
      availableActions: ["CANCELLATION"],
      allowSubmit: false,
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE015",
      status: "RELEASED", // Goods released (IE029)
      availableActions: [], // No actions available after release
      allowSubmit: false,
    },

    // ========================================
    // IE013 (Amendment) Lifecycle
    // ========================================
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE013", // Amendment sent
      status: "TRANSMITTED", // Before response
      availableActions: [], // Wait for response
      allowSubmit: false,
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE013",
      status: "ACCEPTED", // Amendment accepted
      availableActions: ["AMENDMENT", "CANCELLATION"], // Can amend again or cancel
      allowSubmit: false,
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE013",
      status: "REJECTED", // Amendment rejected
      availableActions: [], // Must resubmit original declaration
      allowSubmit: true,
    },

    // ========================================
    // IE014 (Cancellation) Lifecycle
    // ========================================
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE014", // Cancellation sent
      status: "TRANSMITTED", // Before response
      availableActions: [], // Wait for response
      allowSubmit: false,
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE014",
      status: "ACCEPTED", // Cancellation accepted
      availableActions: [], // Declaration cancelled, no further actions
      allowSubmit: false,
    },
    {
      country: "NL",
      procedureCode: "NCTS",
      messageName: "IE014",
      status: "REJECTED", // Cancellation rejected
      availableActions: [], // Cannot cancel, declaration stands
      allowSubmit: false,
    },
  ];

  for (const config of configurations) {
    await db.filingActionConfiguration.upsert({
      where: {
        country_procedureCode_messageName_status: {
          country: config.country,
          procedureCode: config.procedureCode,
          messageName: config.messageName,
          status: config.status,
        },
      },
      update: {
        availableActions: config.availableActions,
        allowSubmit: config.allowSubmit,
        isActive: true,
        updatedAt: new Date(),
        updatedBy: "system",
      },
      create: {
        country: config.country,
        procedureCode: config.procedureCode,
        messageName: config.messageName,
        status: config.status,
        availableActions: config.availableActions,
        allowSubmit: config.allowSubmit,
        isActive: true,
        createdBy: "system",
        updatedBy: "system",
      },
    });
  }

  console.log(`  ✓ ${configurations.length} FilingActionConfiguration rows seeded (NL NCTS)`);
}

/**
 * Main seed function
 */
async function main() {
  console.log("🌱 Seeding multi-country filing configuration...\n");

  try {
    console.log("Step 1: Seeding transaction types...");
    await seedProcedureCatalog();

    console.log("\nStep 2: Seeding action catalog...");
    await seedActionCatalog();

    console.log("\nStep 3: Seeding NL NCTS procedures...");
    await seedNlNctsProcedures();

    console.log("\nStep 4: Seeding NL NCTS action-message mapping...");
    await seedNlNctsActionMessageMapping();

    console.log("\nStep 5: Seeding NL NCTS action configuration...");
    await seedNlNctsActionConfiguration();

    console.log("\n✅ Multi-country filing seed complete!\n");
    console.log("Summary:");
    console.log("  - 7 transaction types");
    console.log("  - 10 actions");
    console.log("  - 3 NL NCTS procedures (IE015, IE013, IE014)");
    console.log("  - 3 NL NCTS action mappings");
    console.log("  - 14 NL NCTS action configuration rules");
    console.log("\nReady to add more countries (IE, FR, IN, etc.)\n");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

main();
