import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui";
import type { AlsoKnownAsSummary } from "@/modules/importers/alsoKnownAs";

export function humanize(value: string | null | undefined) {
  // Lowercased first so an all-caps enum value (e.g. a PartyRoleType like
  // "SUPPLIER") title-cases correctly instead of staying shouted -- every
  // existing caller here already passes lowercase snake_case, for which
  // lowercasing first is a no-op.
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
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
