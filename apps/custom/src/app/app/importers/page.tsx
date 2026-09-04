import { getAccountContext } from "@/lib/auth";
import { db, isDataMode, withDataModeContext } from "@/lib/db";
import { importerReadiness } from "@/modules/importers/importerReadiness";
import { ImportersRegistryClient } from "./ImportersRegistryClient";

interface Props {
  searchParams: Promise<{ view?: string; missing?: string }>;
}

export default async function ImportersPage({ searchParams }: Props) {
  const context = await getAccountContext();
  if (!context) return null;
  const params = await searchParams;
  const importers = await withDataModeContext(
    isDataMode(context.dataMode) ? context.dataMode : null,
    () => db.importerOfRecord.findMany({
      where: { accountId: context.accountId },
      select: {
        id: true,
        name: true,
        irsEin: true,
        cbpImporterNumber: true,
        clientId: true,
        registrationStatus: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
        bond: { select: { id: true, status: true, bondNumber: true, bondType: true, bondAmount: true, continuousBondFormulaAmount: true, expirationDate: true, lastVerifiedAt: true } },
        powersOfAttorney: { select: { id: true, status: true, signerName: true, executionMethod: true, signedDate: true, expirationDate: true, revokedAt: true }, orderBy: { createdAt: "desc" } },
        onboardingEntities: { select: { screeningStatus: true, bondCoverage: true }, orderBy: { updatedAt: "desc" }, take: 10 },
        onboardingCases: { select: { id: true, path: true, status: true, currentStep: true }, orderBy: { updatedAt: "desc" }, take: 1 },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 500,
    }),
  );
  const rows = importers.map((importer) => ({ ...importer, readiness: importerReadiness(importer) }));
  const view = params.view === "bonds" || params.view === "poa" ? params.view : "importers";
  return <ImportersRegistryClient accountName={context.accountName} initialImporters={JSON.parse(JSON.stringify(rows))} initialView={view} initialMissing={params.missing} />;
}
