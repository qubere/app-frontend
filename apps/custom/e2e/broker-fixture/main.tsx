import { useState } from "react";
import { createRoot } from "react-dom/client";
import { PgaHoldResolutionDrawer } from "../../src/app/app/shipments/[id]/PgaHoldResolutionDrawer";
import { AssistEntryBanner } from "../../src/app/app/filing/[id]/AssistEntryBanner";
import { AssistRegistry } from "../../src/app/app/assists/AssistRegistry";
import { Combobox, type ComboboxOption } from "../../src/components/ui/Combobox";
import NewShipmentPage from "../../src/app/app/shipments/new/page";
import { ImportersRegistryClient } from "../../src/app/app/importers/ImportersRegistryClient";
import "../../src/app/globals.css";

// Only production UI components live here. Playwright supplies HTTP fixtures;
// no auth bypass or test route is added to the deployed Next application.

const COMBOBOX_OPTIONS: ComboboxOption[] = [
  { id: "acme-trading", label: "Acme Trading Co", description: "Northwind Retail Inc. · CBP 12-3456789" },
  { id: "acme-dist", label: "Acme Distribution LLC", description: "Pacific Import Partners · CBP registration pending" },
  { id: "northwind-retail", label: "Northwind Retail Inc.", description: "Northwind Retail Inc. · CBP DEMO-NW01" },
  { id: "meridian", label: "Meridian GmbH", description: "Meridian GmbH · CBP registration pending" },
];

function ComboboxHarness() {
  const [value, setValue] = useState<ComboboxOption | null>(null);
  return <Combobox
    label="Importer of record"
    value={value}
    options={COMBOBOX_OPTIONS}
    onChange={setValue}
    placeholder="Search importer, client, CBP number, or EIN"
    emptyMessage="No matches found"
    required
  />;
}

const REGISTRY_IMPORTERS = [
  {
    id: "imp-ready",
    name: "Northwind Retail Inc.",
    irsEin: "81-9003161",
    cbpImporterNumber: "DEMO-NW01",
    clientId: "client-northwind",
    registrationStatus: "registered",
    client: { id: "client-northwind", name: "Northwind Trade Group" },
    bond: { id: "bond-1", status: "verified", bondNumber: "B-1", bondType: "continuous", bondAmount: "250000", continuousBondFormulaAmount: "180000", expirationDate: "2027-01-01", lastVerifiedAt: "2026-08-01" },
    powersOfAttorney: [{ id: "poa-1", status: "executed", signerName: "Nora Chen", executionMethod: "E_SIGN", signedDate: "2026-08-01", expirationDate: "2027-08-01", revokedAt: null }],
    onboardingEntities: [{ screeningStatus: "passed", bondCoverage: "own" }],
    onboardingCases: [{ id: "case-1", path: "STANDARD", status: "active", currentStep: 6 }],
    readiness: { ready: true, label: "Ready to file", blockers: [] },
  },
  {
    id: "imp-poa-pending",
    name: "Northwind Foods LLC",
    irsEin: "81-9003162",
    cbpImporterNumber: "DEMO-NW02",
    clientId: "client-northwind",
    registrationStatus: "registered",
    client: { id: "client-northwind", name: "Northwind Trade Group" },
    bond: null,
    powersOfAttorney: [{ id: "poa-2", status: "out_for_signature", signerName: "Nora Chen", executionMethod: "E_SIGN", signedDate: "2026-08-01", expirationDate: null, revokedAt: null }],
    onboardingEntities: [{ screeningStatus: "pending", bondCoverage: "none" }],
    onboardingCases: [{ id: "case-2", path: "STANDARD", status: "blocked_poa", currentStep: 3 }],
    readiness: { ready: false, label: "POA out for signature", blockers: [{ code: "POA", label: "Execute POA", href: "/app/importers/imp-poa-pending?tab=poa" }] },
  },
  {
    id: "imp-unassigned",
    name: "Legacy Importer Co.",
    irsEin: "81-9003169",
    cbpImporterNumber: "DEMO-LEG1",
    clientId: null,
    registrationStatus: "pending_5106",
    client: null,
    bond: null,
    powersOfAttorney: [],
    onboardingEntities: [],
    onboardingCases: [],
    readiness: { ready: false, label: "Unassigned client", blockers: [{ code: "CLIENT", label: "Attach to a client", href: "/app/importers?client=none" }] },
  },
];

function ImportersRegistryHarness() {
  const initialMissing = new URLSearchParams(location.search).get("missing") ?? undefined;
  return <ImportersRegistryClient
    accountName="Test Broker"
    initialImporters={REGISTRY_IMPORTERS as any}
    initialView="importers"
    initialMissing={initialMissing}
  />;
}

function App() {
  const [open, setOpen] = useState(false);
  const view = new URLSearchParams(location.search).get("view");
  if (view === "combobox") return <main className="min-h-screen bg-white p-6 text-ink max-w-md"><ComboboxHarness /></main>;
  if (view === "shipment-new") return <main className="min-h-screen bg-white text-ink"><NewShipmentPage /></main>;
  if (view === "importers-registry") return <main className="min-h-screen bg-white p-6 text-ink"><ImportersRegistryHarness /></main>;
  return <main className="min-h-screen bg-white p-6 text-ink">
    {view === "assists" ? <AssistEntryBanner filingId="filing" revision="1"/> : view === "registry" ? <AssistRegistry canUpdate/> : <>
      <button onClick={() => setOpen(true)}>Resolve FDA hold</button>
      {open && <PgaHoldResolutionDrawer id="hold" onClose={() => setOpen(false)} onChanged={() => undefined}/>}
    </>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
