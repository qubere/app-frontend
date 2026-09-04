/**
 * Read-only preflight for the ImporterOfRecord.clientId NOT NULL migration.
 *
 * Usage from the repo root:
 *   npm run check:importer-client-gate --workspace=@qubere/custom
 *   npm run check:importer-client-gate --workspace=@qubere/custom -- --account-id=<id>
 *   npm run check:importer-client-gate --workspace=@qubere/custom -- --assert-ready
 *
 * The script never mutates data. `--assert-ready` exits non-zero when any
 * account still has an unassigned importer or a client mismatch.
 */
import { parseArgs } from "node:util";
import { loadEnvConfig } from "@next/env";
import { db, withAccountIdContext, withDataModeContext } from "@qubere/db";
import { summarizeImporterClientGate } from "../src/modules/importers/importerClientGate";

loadEnvConfig(process.cwd());

const { values } = parseArgs({
  options: {
    "account-id": { type: "string" },
    "assert-ready": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

async function main() {
  if (values.help) {
    console.log("Read-only importer/client rollout report. Options: --account-id=<id> --assert-ready");
    return;
  }

  const accounts = await withDataModeContext(null, () => withAccountIdContext(null, () =>
    db.account.findMany({
      where: { deletedAt: null, ...(values["account-id"] ? { id: values["account-id"] } : {}) },
      select: { id: true, name: true, dataMode: true },
      orderBy: { id: "asc" },
    }),
  ));

  const reports = [];
  for (const account of accounts) {
    const rows = await withDataModeContext(account.dataMode, () => withAccountIdContext(account.id, () =>
      db.importerOfRecord.findMany({
        where: { accountId: account.id },
        select: {
          id: true,
          name: true,
          clientId: true,
          legalEntityId: true,
          legalEntity: { select: { clientId: true } },
        },
        orderBy: { id: "asc" },
      }),
    ));
    reports.push({ account: { id: account.id, name: account.name, dataMode: account.dataMode }, ...summarizeImporterClientGate(rows) });
  }

  const ready = reports.every((report) => report.readyForNotNull);
  console.log(JSON.stringify({
    operation: "importer-client-not-null-preflight",
    readOnly: true,
    readyForNotNull: ready,
    accounts: reports,
  }, null, 2));

  if (values["assert-ready"] && !ready) process.exitCode = 2;
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => db.$disconnect());
