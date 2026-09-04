/**
 * Seed the synthetic issue #316 Clients + Importers demo.
 *
 * Usage from the repo root:
 *   npm run seed:clients-importers --workspace=@qubere/custom -- --account-id=<DEMO_OR_SANDBOX_ACCOUNT_ID>
 *   npm run seed:clients-importers --workspace=@qubere/custom -- --account-id=<id> --dry-run
 *
 * The target account is always explicit. The script refuses PRODUCTION
 * workspaces, sends no notifications, and records no customs transmission.
 */
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { Prisma } from "@prisma/client";
import {
  assertDemoSeedingAllowedForWorkspace,
  db,
  isDataMode,
  withAccountIdContext,
  withDataModeContext,
} from "@qubere/db";
import { IMPORTER_DEMO_SCENARIO } from "../src/modules/importers/importerDemoScenario";

loadEnvConfig(process.cwd());

const { values } = parseArgs({
  options: {
    "account-id": { type: "string" },
    "dry-run": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

type Tx = Prisma.TransactionClient;
type ImporterKey = (typeof IMPORTER_DEMO_SCENARIO.importers)[number]["key"];
type ClientKey = (typeof IMPORTER_DEMO_SCENARIO.clients)[number]["key"];

const DAY_MS = 86_400_000;
const atDay = (base: Date, offset: number) => new Date(base.getTime() + offset * DAY_MS);
const normalizedName = (name: string) => name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

function seedPrefix(accountId: string) {
  return `demo316-${createHash("sha256").update(accountId).digest("hex").slice(0, 10)}`;
}

async function seedScenario(tx: Tx, accountId: string, now: Date) {
  const prefix = seedPrefix(accountId);
  const id = (kind: string, key: string) => `${prefix}-${kind}-${key}`;
  const future = atDay(now, 365);
  const clientIds = new Map<ClientKey, string>();
  const legalEntityIds = new Map<ImporterKey, string>();
  const importerIds = new Map<ImporterKey, string>();
  const bondIds = new Map<ImporterKey, string>();

  for (const client of IMPORTER_DEMO_SCENARIO.clients) {
    const row = await tx.client.upsert({
      where: { accountId_name: { accountId, name: client.name } },
      update: {
        paymentTermsDays: client.paymentTermsDays,
        status: "ACTIVE",
        contactName: client.key === "northwind" ? "Nora Chen" : null,
        contactEmail: client.key === "northwind" ? "nora.chen@northwind.example.test" : null,
      },
      create: {
        id: id("client", client.key),
        accountId,
        name: client.name,
        paymentTermsDays: client.paymentTermsDays,
        status: "ACTIVE",
        contactName: client.key === "northwind" ? "Nora Chen" : null,
        contactEmail: client.key === "northwind" ? "nora.chen@northwind.example.test" : null,
      },
      select: { id: true },
    });
    clientIds.set(client.key, row.id);
  }

  const northwindClientId = clientIds.get("northwind")!;
  for (const stakeholder of [
    { key: "cfo", name: "Nora Chen", email: "nora.chen@northwind.example.test", role: "OFFICER_SIGNER" },
    { key: "ops", name: "Miles Grant", email: "miles.grant@northwind.example.test", role: "IMPORTER_ADMIN" },
  ]) {
    await tx.clientStakeholder.upsert({
      where: { clientId_email: { clientId: northwindClientId, email: stakeholder.email } },
      update: {
        name: stakeholder.name,
        role: stakeholder.role,
        loginStatus: "ACTIVE",
        notifyPrefs: { email: false },
        sourceEvent: "SYNTHETIC_DEMO",
      },
      create: {
        id: id("stakeholder", stakeholder.key),
        accountId,
        clientId: northwindClientId,
        name: stakeholder.name,
        email: stakeholder.email,
        role: stakeholder.role,
        isSigner: stakeholder.key === "cfo",
        loginStatus: "ACTIVE",
        notifyPrefs: { email: false },
        sourceEvent: "SYNTHETIC_DEMO",
      },
    });
  }

  const importerDetails: Record<ImporterKey, {
    irsEin: string;
    cbpImporterNumber: string | null;
    country: string;
    entityType: string;
    addressLine1: string;
    city: string;
    stateProvince: string | null;
    postalCode: string;
    path: "STANDARD" | "NON_RESIDENT";
    currentStep: number;
  }> = {
    "northwind-retail": { irsEin: "81-9003161", cbpImporterNumber: `DEMO-${prefix}-NW01`, country: "US", entityType: "US_CORPORATION", addressLine1: "410 Market Street", city: "Minneapolis", stateProvince: "MN", postalCode: "55401", path: "STANDARD", currentStep: 6 },
    "northwind-foods": { irsEin: "81-9003162", cbpImporterNumber: `DEMO-${prefix}-NW02`, country: "US", entityType: "US_LLC", addressLine1: "412 Market Street", city: "Minneapolis", stateProvince: "MN", postalCode: "55401", path: "STANDARD", currentStep: 3 },
    pacific: { irsEin: "81-9003163", cbpImporterNumber: `DEMO-${prefix}-PAC1`, country: "US", entityType: "US_CORPORATION", addressLine1: "700 Harbor Way", city: "Long Beach", stateProvince: "CA", postalCode: "90802", path: "STANDARD", currentStep: 4 },
    meridian: { irsEin: "", cbpImporterNumber: null, country: "DE", entityType: "FOREIGN_CORPORATION", addressLine1: "12 Hafenstrasse", city: "Hamburg", stateProvince: null, postalCode: "20457", path: "NON_RESIDENT", currentStep: 3 },
    legacy: { irsEin: "81-9003169", cbpImporterNumber: `DEMO-${prefix}-LEG1`, country: "US", entityType: "US_CORPORATION", addressLine1: "99 Legacy Lane", city: "Chicago", stateProvince: "IL", postalCode: "60601", path: "STANDARD", currentStep: 1 },
  };

  for (const importer of IMPORTER_DEMO_SCENARIO.importers) {
    const detail = importerDetails[importer.key];
    const clientId = importer.clientKey ? clientIds.get(importer.clientKey)! : null;
    const legalEntityId = id("legal", importer.key);
    legalEntityIds.set(importer.key, legalEntityId);
    await tx.legalEntity.upsert({
      where: { id: legalEntityId },
      update: {
        clientId,
        legalName: importer.name,
        entityType: detail.entityType,
        country: detail.country,
        addressLine1: detail.addressLine1,
        city: detail.city,
        stateProvince: detail.stateProvince,
        postalCode: detail.postalCode,
        taxIdentifier: detail.irsEin || null,
        taxIdentifierType: detail.country === "US" ? "EIN" : "CBP_ASSIGNED",
      },
      create: {
        id: legalEntityId,
        accountId,
        clientId,
        legalName: importer.name,
        entityType: detail.entityType,
        country: detail.country,
        addressLine1: detail.addressLine1,
        city: detail.city,
        stateProvince: detail.stateProvince,
        postalCode: detail.postalCode,
        taxIdentifier: detail.irsEin || null,
        taxIdentifierType: detail.country === "US" ? "EIN" : "CBP_ASSIGNED",
      },
    });

    if (importer.bondAmount !== null) {
      const bondId = id("bond", importer.key);
      bondIds.set(importer.key, bondId);
      await tx.bond.upsert({
        where: { id: bondId },
        update: {
          bondAmount: importer.bondAmount,
          continuousBondFormulaAmount: importer.requiredBondAmount,
          status: "verified",
          lastVerifiedAt: now,
          expirationDate: future,
        },
        create: {
          id: bondId,
          accountId,
          bondNumber: `${prefix}-${importer.key.toUpperCase()}-BOND`,
          bondAmount: importer.bondAmount,
          continuousBondFormulaAmount: importer.requiredBondAmount,
          suretyName: "Synthetic Demo Surety",
          suretyCode: "D99",
          status: "verified",
          lastVerifiedAt: now,
          expirationDate: future,
        },
      });
      await tx.bondVerification.upsert({
        where: { id: id("bond-verification", importer.key) },
        update: {
          result: "match",
          performedAt: now,
          responseRaw: "SYNTHETIC DEMO KI/KR MATCH — NOT A CBP RESPONSE",
        },
        create: {
          id: id("bond-verification", importer.key),
          accountId,
          bondId,
          method: "CBP_IMPORTER_BOND_QUERY",
          result: "match",
          queriedImporterNumber: detail.cbpImporterNumber,
          requestRaw: "SYNTHETIC DEMO QUERY — NOT TRANSMITTED",
          responseRaw: "SYNTHETIC DEMO KI/KR MATCH — NOT A CBP RESPONSE",
          suretyCode: "D99",
          suretyName: "Synthetic Demo Surety",
          performedAt: now,
        },
      });
    }

    const importerId = id("importer", importer.key);
    importerIds.set(importer.key, importerId);
    const registered = ["READY", "POA_PENDING", "BOND_SHORT"].includes(importer.state);
    await tx.importerOfRecord.upsert({
      where: { id: importerId },
      update: {
        clientId,
        legalEntityId,
        name: importer.name,
        irsEin: detail.irsEin,
        cbpImporterNumber: detail.cbpImporterNumber,
        registrationStatus: registered ? "registered" : "pending_5106",
        address: {
          line1: detail.addressLine1,
          city: detail.city,
          state: detail.stateProvince ?? "",
          postalCode: detail.postalCode,
          country: detail.country,
          synthetic: true,
        },
        bondId: bondIds.get(importer.key) ?? null,
      },
      create: {
        id: importerId,
        accountId,
        clientId,
        legalEntityId,
        name: importer.name,
        irsEin: detail.irsEin,
        cbpImporterNumber: detail.cbpImporterNumber,
        registrationStatus: registered ? "registered" : "pending_5106",
        address: {
          line1: detail.addressLine1,
          city: detail.city,
          state: detail.stateProvince ?? "",
          postalCode: detail.postalCode,
          country: detail.country,
          synthetic: true,
        },
        bondId: bondIds.get(importer.key) ?? null,
      },
    });

    const caseId = id("case", importer.key);
    const active = importer.state === "READY";
    const blockers = importer.state === "POA_PENDING"
      ? ["POA_NOT_EXECUTED"]
      : importer.state === "BOND_SHORT"
        ? ["BOND_INSUFFICIENT"]
        : importer.key === "meridian"
          ? ["CBP_NUMBER_PENDING", "POA_DOCUMENT_PENDING"]
          : importer.key === "legacy"
            ? ["CLIENT_UNASSIGNED"]
            : [];
    await tx.onboardingCase.upsert({
      where: { id: caseId },
      update: {
        clientId,
        primaryImporterId: importerId,
        path: detail.path,
        status: active ? "active" : importer.state === "BOND_SHORT" ? "blocked_bond" : "in_progress",
        currentStep: detail.currentStep,
        projectedAnnualDutyTaxFee: importer.projectedAnnualDutyTaxFee,
        blockers,
        stepStatus: active ? { step_1: "done", step_2: "done", step_3: "done", step_4: "done", step_5: "done", step_6: "done" } : { step_1: "done" },
        activatedAt: active ? now : null,
        source: "SYNTHETIC_DEMO",
      },
      create: {
        id: caseId,
        accountId,
        clientId,
        primaryImporterId: importerId,
        path: detail.path,
        status: active ? "active" : importer.state === "BOND_SHORT" ? "blocked_bond" : "in_progress",
        currentStep: detail.currentStep,
        projectedAnnualDutyTaxFee: importer.projectedAnnualDutyTaxFee,
        blockers,
        stepStatus: active ? { step_1: "done", step_2: "done", step_3: "done", step_4: "done", step_5: "done", step_6: "done" } : { step_1: "done" },
        activatedAt: active ? now : null,
        source: "SYNTHETIC_DEMO",
      },
    });

    const poaId = id("poa", importer.key);
    const poaStatus = importer.state === "POA_PENDING" ? "out_for_signature" : importer.key === "meridian" ? "draft" : registered ? "executed" : "draft";
    await tx.powerOfAttorney.upsert({
      where: { id: poaId },
      update: {
        importerOfRecordId: importerId,
        grantedByEntity: importer.name,
        status: poaStatus,
        signerName: importer.key === "meridian" ? "Resident-agent signer pending" : "Nora Chen",
        signerTitle: importer.key === "meridian" ? null : "Chief Financial Officer",
        signerRole: importer.key === "meridian" ? "OFFICER" : "OFFICER",
        signerEmail: importer.key === "meridian" ? null : "nora.chen@northwind.example.test",
        executionMethod: importer.key === "meridian" ? "WET_INK_NOTARIZED" : "E_SIGN",
        signedDate: now,
        expirationDate: registered && importer.state !== "POA_PENDING" ? future : null,
        executedDocumentUrl: registered && importer.state !== "POA_PENDING" ? `demo://${prefix}/${importer.key}/poa-executed.pdf` : null,
      },
      create: {
        id: poaId,
        accountId,
        importerOfRecordId: importerId,
        grantedByEntity: importer.name,
        status: poaStatus,
        signerName: importer.key === "meridian" ? "Resident-agent signer pending" : "Nora Chen",
        signerTitle: importer.key === "meridian" ? null : "Chief Financial Officer",
        signerRole: "OFFICER",
        signerEmail: importer.key === "meridian" ? null : "nora.chen@northwind.example.test",
        executionMethod: importer.key === "meridian" ? "WET_INK_NOTARIZED" : "E_SIGN",
        signedDate: now,
        expirationDate: registered && importer.state !== "POA_PENDING" ? future : null,
        executedDocumentUrl: registered && importer.state !== "POA_PENDING" ? `demo://${prefix}/${importer.key}/poa-executed.pdf` : null,
      },
    });

    const entityId = id("onboarding-entity", importer.key);
    await tx.onboardingEntity.upsert({
      where: { id: entityId },
      update: {
        caseId,
        legalEntityId,
        importerOfRecordId: importerId,
        importerNumberType: detail.country === "US" ? "EIN" : "CBP_ASSIGNED",
        importerNumber: detail.irsEin || null,
        residentAgent: importer.key === "meridian" ? { name: "Harbor Resident Agent LLC", city: "New York", country: "US", synthetic: true } : Prisma.JsonNull,
        officers: [{ name: "Synthetic Demo Officer", role: "OFFICER" }],
        poaId,
        bondId: bondIds.get(importer.key) ?? null,
        bondCoverage: importer.key === "meridian" ? "broker_bond" : bondIds.has(importer.key) ? "own" : "none",
        screeningStatus: registered ? "passed" : "pending",
      },
      create: {
        id: entityId,
        accountId,
        caseId,
        legalEntityId,
        importerOfRecordId: importerId,
        importerNumberType: detail.country === "US" ? "EIN" : "CBP_ASSIGNED",
        importerNumber: detail.irsEin || null,
        residentAgent: importer.key === "meridian" ? { name: "Harbor Resident Agent LLC", city: "New York", country: "US", synthetic: true } : undefined,
        officers: [{ name: "Synthetic Demo Officer", role: "OFFICER" }],
        poaId,
        bondId: bondIds.get(importer.key) ?? null,
        bondCoverage: importer.key === "meridian" ? "broker_bond" : bondIds.has(importer.key) ? "own" : "none",
        screeningStatus: registered ? "passed" : "pending",
      },
    });

    await tx.fiveOhSixRecord.upsert({
      where: { id: id("5106", importer.key) },
      update: {
        caseId,
        onboardingEntityId: entityId,
        legalEntityId,
        status: registered ? "accepted" : importer.key === "meridian" ? "draft" : "generated",
        cbpAssignedNumber: registered ? detail.cbpImporterNumber : null,
        acceptedAt: registered ? now : null,
      },
      create: {
        id: id("5106", importer.key),
        accountId,
        caseId,
        onboardingEntityId: entityId,
        legalEntityId,
        action: "CREATE",
        importerNumberType: detail.country === "US" ? "EIN" : "CBP_ASSIGNED",
        importerNumber: detail.irsEin || null,
        payload: { synthetic: true },
        provenance: { source: "ISSUE_316_DEMO_SEED" },
        status: registered ? "accepted" : importer.key === "meridian" ? "draft" : "generated",
        deliveryMethod: registered ? "ACE_PORTAL" : null,
        cbpResponseRaw: registered ? "SYNTHETIC DEMO ACCEPTANCE — NOT A CBP RESPONSE" : null,
        cbpAssignedNumber: registered ? detail.cbpImporterNumber : null,
        acceptedAt: registered ? now : null,
      },
    });

    await tx.onboardingEvent.upsert({
      where: { id: id("event", importer.key) },
      update: { detail: { synthetic: true, state: importer.state }, createdAt: now },
      create: {
        id: id("event", importer.key),
        accountId,
        caseId,
        type: "SYNTHETIC_DEMO_STATE_SEEDED",
        step: detail.currentStep,
        actorType: "SYSTEM",
        detail: { synthetic: true, state: importer.state },
        createdAt: now,
      },
    });
  }

  const atlasClientId = clientIds.get("atlas")!;
  for (const role of ["MANUFACTURER", "SELLER"] as const) {
    const key = role.toLowerCase();
    const partyId = id("party", key);
    await tx.party.upsert({
      where: { id: partyId },
      update: { clientId: atlasClientId, status: "ACTIVE" },
      create: {
        id: partyId,
        accountId,
        clientId: atlasClientId,
        internalPartyCode: `${prefix}-${role}`,
        status: "ACTIVE",
      },
    });
    const partyName = role === "MANUFACTURER" ? "Atlas Precision Manufacturing" : "Atlas Component Sales";
    await tx.partyName.upsert({
      where: { id: id("party-name", key) },
      update: { rawName: partyName, normalizedName: normalizedName(partyName), isPrimary: true },
      create: {
        id: id("party-name", key),
        accountId,
        partyId,
        nameType: "LEGAL",
        rawName: partyName,
        normalizedName: normalizedName(partyName),
        isPrimary: true,
        sourceType: "IMPORT",
      },
    });
    await tx.partyRole.upsert({
      where: { id: id("party-role", key) },
      update: { roleType: role, status: "ACTIVE" },
      create: {
        id: id("party-role", key),
        accountId,
        partyId,
        roleType: role,
        status: "ACTIVE",
        sourceType: "IMPORT",
      },
    });
  }

  const northwindImporterId = importerIds.get("northwind-retail")!;
  for (let index = 1; index <= IMPORTER_DEMO_SCENARIO.northwindShipmentCount; index += 1) {
    const shipmentNumber = `SHP-NORTHWIND-2026-${String(index).padStart(3, "0")}`;
    await tx.shipment.upsert({
      where: { accountId_shipmentNumber: { accountId, shipmentNumber } },
      update: {
        importerOfRecordId: northwindImporterId,
        importerName: "Northwind Retail Inc.",
        clientId: northwindClientId,
        status: index === 1 ? "Ready to File" : "In Progress",
      },
      create: {
        id: id("shipment", `northwind-${index}`),
        accountId,
        shipmentNumber,
        importerOfRecordId: northwindImporterId,
        importerName: "Northwind Retail Inc.",
        clientId: northwindClientId,
        countryOfExport: index % 2 ? "CN" : "VN",
        countryOfOrigin: index % 2 ? "CN" : "VN",
        destinationCountry: "US",
        transportMode: index % 2 ? "Ocean" : "Air",
        portOfEntry: index % 2 ? "2704" : "2720",
        estimatedArrival: atDay(now, index + 1),
        status: index === 1 ? "Ready to File" : "In Progress",
        customsRequired: true,
      },
    });
  }

  const pacificImporterId = importerIds.get("pacific")!;
  const pacificClientId = clientIds.get("pacific")!;
  const pacificShipment = await tx.shipment.upsert({
    where: { accountId_shipmentNumber: { accountId, shipmentNumber: "SHP-PACIFIC-2026-001" } },
    update: {
      importerOfRecordId: pacificImporterId,
      importerName: "Pacific Import Partners",
      clientId: pacificClientId,
      status: "Ready to File",
    },
    create: {
      id: id("shipment", "pacific-1"),
      accountId,
      shipmentNumber: "SHP-PACIFIC-2026-001",
      importerOfRecordId: pacificImporterId,
      importerName: "Pacific Import Partners",
      clientId: pacificClientId,
      countryOfExport: "CN",
      countryOfOrigin: "CN",
      destinationCountry: "US",
      transportMode: "Ocean",
      portOfEntry: "2704",
      estimatedArrival: atDay(now, 2),
      status: "Ready to File",
      customsRequired: true,
    },
  });
  await tx.customsFiling.upsert({
    where: { id: id("filing", "pacific-blocked") },
    update: {
      shipmentId: pacificShipment.id,
      importerOfRecordId: pacificImporterId,
      bondId: bondIds.get("pacific"),
      filingStatus: "Draft",
      submittedAt: null,
      transmittedByUserId: null,
    },
    create: {
      id: id("filing", "pacific-blocked"),
      accountId,
      shipmentId: pacificShipment.id,
      importerOfRecordId: pacificImporterId,
      bondId: bondIds.get("pacific"),
      entryNumber: `DEMO-${prefix}-PAC-DRAFT`,
      country: "US",
      procedureCode: "IMPORT",
      filingType: "ENTRY_SUMMARY",
      filingStatus: "Draft",
      totalValue: 1_800_000,
      totalDuties: 180_000,
      dutyBreakdown: [{ label: "Synthetic projected annual duty exposure", amount: 180000 }],
    },
  });

  return {
    prefix,
    clients: Object.fromEntries(clientIds),
    importers: Object.fromEntries(importerIds),
    links: {
      clients: "/app/clients",
      importers: "/app/importers",
      northwind: `/app/importers/${northwindImporterId}`,
      pacific: `/app/importers/${pacificImporterId}?tab=bond`,
      meridian: `/app/importers/${importerIds.get("meridian")}?tab=poa`,
      unassigned: "/app/importers?client=none",
      blockedFiling: `/app/filing/${id("filing", "pacific-blocked")}`,
    },
  };
}

async function main() {
  if (values.help) {
    console.log("Seed synthetic Clients + Importers demo data. Required: --account-id=<DEMO_OR_SANDBOX_ACCOUNT_ID>. Optional: --dry-run.");
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const accountId = values["account-id"];
  if (!accountId) throw new Error("--account-id is required; the seed never guesses a target workspace.");

  const account = await withDataModeContext(null, () => withAccountIdContext(null, () =>
    db.account.findUnique({ where: { id: accountId }, select: { id: true, name: true, dataMode: true } }),
  ));
  if (!account || !isDataMode(account.dataMode)) throw new Error(`Account ${accountId} was not found.`);
  assertDemoSeedingAllowedForWorkspace(account.dataMode, account.id);

  if (values["dry-run"]) {
    console.log(JSON.stringify({
      operation: "seed-clients-importers-demo",
      dryRun: true,
      synthetic: true,
      account,
      scenario: IMPORTER_DEMO_SCENARIO,
    }, null, 2));
    return;
  }

  const result = await withDataModeContext(account.dataMode, () => withAccountIdContext(account.id, () =>
    db.$transaction((tx) => seedScenario(tx, account.id, new Date()), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 30_000,
    }),
  ));
  console.log(JSON.stringify({
    operation: "seed-clients-importers-demo",
    dryRun: false,
    synthetic: true,
    notificationsSent: false,
    customsTransmissions: 0,
    account,
    scenario: IMPORTER_DEMO_SCENARIO.name,
    ...result,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Clients + Importers demo seed failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
