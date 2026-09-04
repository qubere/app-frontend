import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CheckCircle2, Circle, Clock3, FileCheck2, Sparkles } from "lucide-react";
import { getAccountContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildAlsoKnownAs, type AlsoKnownAsSummary } from "@/modules/importers/alsoKnownAs";
import { importerReadiness } from "@/modules/importers/importerReadiness";
import { Badge, Card } from "@/components/ui";

const TABS = [
  ["overview", "Overview"],
  ["legal", "Legal details"],
  ["5106", "CBP registration"],
  ["poa", "Power of Attorney"],
  ["bond", "Bond"],
  ["screening", "Screening"],
  ["history", "History"],
] as const;

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

function humanize(value: string | null | undefined) {
  // Lowercased first so an all-caps enum value (e.g. a PartyRoleType like
  // "SUPPLIER") title-cases correctly instead of staying shouted -- every
  // existing caller here already passes lowercase snake_case, for which
  // lowercasing first is a no-op.
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
}

export default async function ImporterRecordPage({ params, searchParams }: Props) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, getAccountContext()]);
  if (!context) return null;
  const importer = await db.importerOfRecord.findFirst({
    where: { id, accountId: context.accountId },
    include: {
      client: { select: { id: true, name: true, paymentTermsDays: true } },
      legalEntity: {
        include: {
          // #320 Phase 1 bridge -- the "Also known as" panel's data (spec
          // §3.5). Null until resolvePartyForCompany has linked this legal
          // entity to a Party; that is an expected, unremarkable state
          // (pre-backfill, or a resolution that only found candidates), not
          // an error.
          party: {
            select: {
              id: true,
              roles: { where: { status: "ACTIVE" }, select: { roleType: true, status: true } },
              legalEntities: { select: { id: true, _count: { select: { productParties: true, shipmentParties: true } } } },
            },
          },
        },
      },
      bond: { include: { verifications: { orderBy: { performedAt: "desc" }, take: 10 } } },
      powersOfAttorney: { include: { envelope: true }, orderBy: { createdAt: "desc" } },
      onboardingEntities: { include: { case: { select: { id: true, path: true, status: true, currentStep: true } } }, orderBy: { updatedAt: "desc" } },
      onboardingCases: { include: { fiveOhSixRecords: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "desc" }, take: 50 } }, orderBy: { updatedAt: "desc" } },
      shipments: { select: { id: true, shipmentNumber: true, status: true, estimatedArrival: true }, orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { shipments: true, customsFilings: true } },
    },
  });
  if (!importer) notFound();
  const readiness = importerReadiness(importer);
  const party = importer.legalEntity?.party ?? null;
  const alsoKnownAs = party ? buildAlsoKnownAs(party, importer.legalEntity!.id) : null;
  const activeTab = TABS.some(([key]) => key === query.tab) ? query.tab! : "overview";
  const currentCase = importer.onboardingCases[0] ?? importer.onboardingEntities[0]?.case ?? null;
  const onboarding = Boolean(currentCase && currentCase.status !== "active");
  const fiveOhSixRecords = importer.onboardingCases.flatMap((item) => item.fiveOhSixRecords);
  const events = importer.onboardingCases.flatMap((item) => item.events).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link href="/app/importers" className="inline-flex items-center gap-1.5 text-xs font-bold text-ink-muted hover:text-brand"><ArrowLeft className="h-3.5 w-3.5" /> Importers</Link>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand/15 bg-brand/10 text-brand"><Building2 className="h-5 w-5" /></div>
          <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-extrabold tracking-tight text-ink">{importer.name}</h1><Badge variant={readiness.ready ? "success" : "warning"}>{readiness.label}</Badge></div><p className="mt-1 text-xs text-ink-muted">{importer.client?.name ?? "Unassigned client"} · {importer.cbpImporterNumber ?? "CBP number pending"}</p></div>
        </div>
        {onboarding && currentCase && <Link href={`/app/onboarding/${currentCase.id}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-brand-hover">Continue onboarding <ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>

      <div className={`rounded-2xl border p-4 ${readiness.ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          {readiness.ready ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
          <div className="min-w-0 flex-1"><p className={`text-sm font-extrabold ${readiness.ready ? "text-emerald-900" : "text-amber-950"}`}>{readiness.ready ? "Ready to file" : `${readiness.blockers.length} item${readiness.blockers.length === 1 ? "" : "s"} block filing`}</p>{readiness.ready ? <p className="mt-1 text-xs text-emerald-800">CBP registration, POA, bond coverage, screening, and client ownership are current.</p> : <div className="mt-2 flex flex-wrap gap-2">{readiness.blockers.map((blocker) => <Link key={blocker.code} href={blocker.href} className="rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:border-amber-500">{blocker.label} <span aria-hidden>→</span></Link>)}</div>}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="h-max p-2">
          {onboarding && <div className="mb-2 border-b border-border px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-brand">Onboarding in progress</p><p className="mt-1 text-xs text-ink-muted">Step {currentCase?.currentStep ?? 1} · {humanize(currentCase?.path)}</p></div>}
          <nav aria-label={onboarding ? "Importer onboarding steps" : "Importer sections"}>
            {onboarding ? <ol className="space-y-1">{TABS.map(([key, label], index) => <li key={key}><ImporterTab href={`/app/importers/${id}?tab=${key}`} active={activeTab === key} current={index + 1 === currentCase?.currentStep} label={label} index={index} /></li>)}</ol> : <div className="space-y-1">{TABS.map(([key, label], index) => <ImporterTab key={key} href={`/app/importers/${id}?tab=${key}`} active={activeTab === key} label={label} index={index} />)}</div>}
          </nav>
        </Card>

        <div className="min-w-0">
          {activeTab === "overview" && <Overview importer={importer} readiness={readiness} alsoKnownAs={alsoKnownAs} partyId={party?.id ?? null} />}
          {activeTab === "legal" && <LegalDetails importer={importer} />}
          {activeTab === "5106" && <Registration records={fiveOhSixRecords} caseId={currentCase?.id} />}
          {activeTab === "poa" && <PoaDetails importer={importer} caseId={currentCase?.id} />}
          {activeTab === "bond" && <BondDetails importer={importer} caseId={currentCase?.id} />}
          {activeTab === "screening" && <ScreeningDetails importer={importer} caseId={currentCase?.id} />}
          {activeTab === "history" && <History events={events} />}
        </div>
      </div>
    </div>
  );
}

function ImporterTab({ href, active, current, label, index }: { href: string; active: boolean; current?: boolean; label: string; index: number }) {
  return <Link href={href} aria-current={current ? "step" : active ? "page" : undefined} className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold transition-colors ${active ? "bg-brand text-white" : "text-ink-muted hover:bg-surface-muted hover:text-ink"}`}>{current ? <Clock3 className="h-4 w-4" /> : index === 0 ? <FileCheck2 className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}<span>{label}</span></Link>;
}

function Field({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return <div className="border-b border-border py-3 last:border-0 sm:grid sm:grid-cols-[190px_1fr] sm:gap-4"><dt className="text-xs font-semibold text-ink-muted">{label}</dt><dd className={`mt-1 text-xs font-semibold text-ink sm:mt-0 ${mono ? "font-mono" : ""}`}>{value || "—"}</dd></div>;
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return <Card className="p-5"><div className="mb-3"><h2 className="text-base font-extrabold text-ink">{title}</h2>{subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}</div><dl>{children}</dl></Card>;
}

function Overview({ importer, readiness, alsoKnownAs, partyId }: { importer: any; readiness: ReturnType<typeof importerReadiness>; alsoKnownAs: AlsoKnownAsSummary | null; partyId: string | null }) {
  return <div className="space-y-4"><Section title="Filing identity" subtitle="These values are inherited by new shipments; brokers do not re-key them."><Field label="Client" value={importer.client ? <Link href={`/app/clients/${importer.client.id}`} className="text-brand hover:underline">{importer.client.name}</Link> : <span className="text-amber-700">Unassigned</span>} /><Field label="CBP importer number" value={importer.cbpImporterNumber} mono /><Field label="Tax identifier" value={importer.irsEin} mono /><Field label="CBP registration" value={<Badge variant={importer.registrationStatus === "registered" ? "success" : "warning"}>{humanize(importer.registrationStatus)}</Badge>} /><Field label="Filing readiness" value={<Badge variant={readiness.ready ? "success" : "warning"}>{readiness.label}</Badge>} /></Section><Section title="Operational footprint"><Field label="Shipments" value={importer._count.shipments} /><Field label="Customs filings" value={importer._count.customsFilings} /><Field label="Recent shipment" value={importer.shipments[0] ? <Link href={`/app/shipments/${importer.shipments[0].id}`} className="text-brand hover:underline">{importer.shipments[0].shipmentNumber} · {importer.shipments[0].status}</Link> : "None"} /></Section><AlsoKnownAsPanel summary={alsoKnownAs} partyId={partyId} /></div>;
}

/**
 * The "one party record, N roles" payoff (#320 spec §3.5): what else this
 * importer's underlying company does, so a supplier that later becomes an
 * importer of record is recognized as the same company instead of two
 * unrelated pages. Renders nothing when there's genuinely nothing to say --
 * a freshly registered importer with no other roles or linked records is a
 * common, unremarkable state, not an empty error state.
 */
export function AlsoKnownAsPanel({ summary, partyId }: { summary: AlsoKnownAsSummary | null; partyId: string | null }) {
  if (!summary) return null;
  const facts: string[] = [];
  if (summary.otherRoles.length > 0) facts.push(`Also ${summary.otherRoles.map(humanize).join(", ")} in your party master`);
  if (summary.productPartyCount > 0) facts.push(`Party on ${summary.productPartyCount} product${summary.productPartyCount === 1 ? "" : "s"}`);
  if (summary.shipmentPartyCount > 0) facts.push(`Party on ${summary.shipmentPartyCount} shipment${summary.shipmentPartyCount === 1 ? "" : "s"}`);
  if (summary.linkedLegalEntityCount > 0) facts.push(`${summary.linkedLegalEntityCount} other linked legal entity record${summary.linkedLegalEntityCount === 1 ? "" : "s"}`);
  if (facts.length === 0) return null;

  return (
    <Card className="border-brand/20 bg-brand/[0.03] p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Sparkles className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-extrabold text-ink">Also known as</h2>
          <p className="mt-1 text-xs text-ink-muted">Same company, one party record — screening history and aliases carry across every role.</p>
          <ul className="mt-3 space-y-1.5">
            {facts.map((fact) => (
              <li key={fact} className="flex items-center gap-2 text-xs font-semibold text-ink">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                {fact}
              </li>
            ))}
          </ul>
          {partyId && <Link href={`/app/parties/${partyId}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline">View full party record <ArrowRight className="h-3 w-3" /></Link>}
        </div>
      </div>
    </Card>
  );
}

function LegalDetails({ importer }: { importer: any }) { const legal = importer.legalEntity; return <Section title="Legal details" subtitle="Canonical company identity used for CBP registration and screening."><Field label="Legal name" value={legal?.legalName ?? importer.name} /><Field label="Trade name" value={legal?.tradeName} /><Field label="Entity type" value={humanize(legal?.entityType)} /><Field label="Formation country" value={legal?.country} /><Field label="Tax identifier" value={legal?.taxIdentifier ?? importer.irsEin} mono /><Field label="Address" value={legal ? [legal.addressLine1, legal.addressLine2, legal.city, legal.stateProvince, legal.postalCode, legal.country].filter(Boolean).join(", ") : "Stored on importer record"} /></Section>; }

function Registration({ records, caseId }: { records: any[]; caseId?: string }) { const record = records[0]; return <Section title="CBP registration (5106)" subtitle="Registration evidence and current authority status."><Field label="Status" value={<Badge variant={record?.status === "accepted" ? "success" : "warning"}>{humanize(record?.status ?? "not started")}</Badge>} /><Field label="Action" value={humanize(record?.action)} /><Field label="Submitted" value={formatDate(record?.submittedAt)} /><Field label="Accepted" value={formatDate(record?.acceptedAt)} />{caseId && <Field label="Next action" value={<Link href={`/app/onboarding/${caseId}?step=2`} className="text-brand hover:underline">Open 5106 workspace →</Link>} />}</Section>; }

function PoaDetails({ importer, caseId }: { importer: any; caseId?: string }) { const poa = importer.powersOfAttorney[0]; return <Section title="Power of Attorney" subtitle="Execution status, signer identity, and expiry evidence."><Field label="Status" value={<Badge variant={poa?.status === "executed" && !poa?.revokedAt ? "success" : "warning"}>{humanize(poa?.status ?? "missing")}</Badge>} /><Field label="Signer" value={poa?.signerName} /><Field label="Signer authority" value={humanize(poa?.signerRole)} /><Field label="Execution method" value={humanize(poa?.executionMethod)} /><Field label="Effective" value={formatDate(poa?.signedDate)} /><Field label="Expires" value={formatDate(poa?.expirationDate)} />{caseId && <Field label="Next action" value={<Link href={`/app/onboarding/${caseId}?step=3`} className="text-brand hover:underline">Open POA workspace →</Link>} />}</Section>; }

function BondDetails({ importer, caseId }: { importer: any; caseId?: string }) { const bond = importer.bond; const verification = bond?.verifications[0]; return <Section title="Customs bond" subtitle="Coverage and the latest CBP verification evidence."><Field label="Status" value={<Badge variant={bond && ["verified", "attested"].includes(bond.status) ? "success" : "warning"}>{humanize(bond?.status ?? "missing")}</Badge>} /><Field label="Bond number" value={bond?.bondNumber} mono /><Field label="Surety" value={bond?.suretyName} /><Field label="Coverage" value={bond ? `$${Number(bond.bondAmount).toLocaleString()}` : "—"} /><Field label="Required coverage" value={bond?.continuousBondFormulaAmount ? `$${Number(bond.continuousBondFormulaAmount).toLocaleString()}` : "—"} /><Field label="Last verified" value={formatDate(bond?.lastVerifiedAt)} /><Field label="Evidence" value={verification ? `${humanize(verification.method)} · ${humanize(verification.result)}` : "No verification result"} />{caseId && <Field label="Next action" value={<Link href={`/app/onboarding/${caseId}?step=4`} className="text-brand hover:underline">Open bond workspace →</Link>} />}</Section>; }

function ScreeningDetails({ importer, caseId }: { importer: any; caseId?: string }) { const status = importer.onboardingEntities[0]?.screeningStatus ?? "pending"; const blocked = status === "blocked"; return <Section title="Screening" subtitle="Denied-party screening for the importer and its principals."><Field label="Current disposition" value={<Badge variant={["passed", "overridden"].includes(status) ? "success" : blocked ? "danger" : "warning"}>{humanize(status)}</Badge>} />{blocked && <Field label="Authority" value={<span className="text-red-700">Compliance authority is required to override a confirmed block.</span>} />}{caseId && <Field label="Next action" value={<Link href={`/app/onboarding/${caseId}?step=5`} className="text-brand hover:underline">Open screening workspace →</Link>} />}</Section>; }

function History({ events }: { events: any[] }) { return <Card className="p-5"><h2 className="text-base font-extrabold text-ink">History</h2><p className="mt-1 text-xs text-ink-muted">Onboarding events and consequential changes, newest first.</p><div className="mt-4 divide-y divide-border">{events.length ? events.map((event) => <div key={event.id} className="flex gap-3 py-3"><div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" /><div><p className="text-xs font-bold text-ink">{humanize(event.type)}</p><p className="mt-1 text-[11px] text-ink-muted">{formatDate(event.createdAt)}{event.step ? ` · Step ${event.step}` : ""}</p></div></div>) : <p className="py-8 text-center text-xs text-ink-muted">No history recorded yet.</p>}</div></Card>; }
