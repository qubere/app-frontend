import Link from "next/link";
import { AlertTriangle, Building2, CheckCircle2, Contact2, UserRoundPlus } from "lucide-react";
import { PanelHeading } from "@/components/PanelHeading";
import { ClientNavTabs } from "@/components/clients/ClientNavTabs";
import { Card } from "@/components/ui";
import { ClientsTable } from "./ClientsTable";
import type { ClientsData, FormattedClient } from "@/lib/clients/clientsData";

interface ClientsPanelProps {
  accountName: string;
  clients: FormattedClient[];
  portfolio?: ClientsData["portfolio"];
  onSaved?: () => void;
  compact?: boolean;
}

export function ClientsPanel({ accountName, clients, portfolio, onSaved, compact }: ClientsPanelProps) {
  const summary = portfolio ?? {
    clientCount: clients.length,
    importerCount: clients.reduce((sum, client) => sum + client.importers.length, 0),
    readyImporterCount: clients.reduce((sum, client) => sum + client.importers.filter((importer) => importer.readiness.ready).length, 0),
    onboardingImporterCount: clients.reduce((sum, client) => sum + client.importers.filter((importer) => !importer.readiness.ready).length, 0),
    unassignedImporterCount: 0,
  };
  const stats = [
    { label: "Clients", value: summary.clientCount, icon: Contact2, color: "text-ink" },
    { label: "Importers", value: summary.importerCount, icon: Building2, color: "text-brand" },
    { label: "Ready to file", value: summary.readyImporterCount, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Onboarding", value: summary.onboardingImporterCount, icon: UserRoundPlus, color: "text-amber-600" },
  ];
  return (
    <div className={compact ? "space-y-5" : "mx-auto max-w-7xl space-y-5"}>
      <PanelHeading
        icon={Contact2}
        badge="Commercial portfolio"
        title="Clients"
        subtitle={`Billing relationships, portal access, and importer coverage for ${accountName}.`}
        compact={compact}
      />

      {!compact && <ClientNavTabs />}

      {!compact && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="flex items-center gap-3 p-4">
              <Icon className={`h-5 w-5 ${color}`} />
              <div><p className="text-xl font-extrabold text-ink">{value}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p></div>
            </Card>
          ))}
          <Link href="/app/importers?client=none" className="block">
            <Card className="flex h-full items-center gap-3 p-4 transition-colors hover:border-amber-300 hover:bg-amber-50/40">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div><p className="text-xl font-extrabold text-ink">{summary.unassignedImporterCount}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Unassigned importers</p></div>
            </Card>
          </Link>
        </div>
      )}

      <ClientsTable clients={clients} onSaved={onSaved} />
    </div>
  );
}
