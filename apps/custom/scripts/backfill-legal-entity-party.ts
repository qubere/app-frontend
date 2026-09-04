/**
 * scripts/backfill-legal-entity-party.ts
 *
 * #320 Phase 1, migration 3 (docs/apps/customs/feature/PARTY-LEGAL-ENTITY-IMPORTER-UNIFICATION.md
 * §5.3, §7): backfills `LegalEntity.partyId` for every `LegalEntity` reachable
 * from an `ImporterOfRecord.legalEntityId` -- the bridge column that already
 * exists on both models but was never populated. Uses `resolvePartyForCompany`,
 * the exact same identity-resolution path `POST /api/importers` now uses for a
 * brand-new legal entity (importerCreate.service.ts), so backfill and live
 * creation share one matching implementation instead of two that could drift
 * apart.
 *
 * A row whose best match is only POSSIBLE_MATCH or AMBIGUOUS is never
 * auto-linked -- reported as NEEDS_MANUAL_REVIEW and left alone, same rule
 * resolvePartyForCompany itself enforces for every other caller.
 *
 * Dry-run by default -- reports what it would do and writes nothing.
 * Idempotent: a row already carrying partyId is skipped, so a partial
 * --apply run (or a re-run after new importers were created in between) only
 * acts on what is still unset.
 *
 * Run from repo root:
 *   npx tsx apps/custom/scripts/backfill-legal-entity-party.ts                    # dry run, every account
 *   npx tsx apps/custom/scripts/backfill-legal-entity-party.ts --account-id=<id>  # dry run, one account
 *   npx tsx apps/custom/scripts/backfill-legal-entity-party.ts --apply
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : undefined;
}
const APPLY = process.argv.includes("--apply");
const ACCOUNT_ID = arg("account-id");

async function main() {
  const { db, withDataModeContext, withAccountIdContext } = await import("@/lib/db");
  const { resolvePartyForCompany } = await import("@/modules/party/partyResolutionService");

  await withDataModeContext(null, async () => {
    const legalEntities = await db.legalEntity.findMany({
      where: {
        partyId: null,
        importerOfRecord: { isNot: null },
        ...(ACCOUNT_ID ? { accountId: ACCOUNT_ID } : {}),
      },
      orderBy: { id: "asc" },
    });

    console.log(
      `[backfill-legal-entity-party] mode=${APPLY ? "APPLY" : "DRY_RUN"} scope=${ACCOUNT_ID ?? "all accounts"} candidates=${legalEntities.length}`
    );

    let created = 0;
    let linked = 0;
    let needsReview = 0;
    let failed = 0;

    for (const entity of legalEntities) {
      const actor = { accountId: entity.accountId, userId: null };
      // Same rule importerCreate.service.ts applies: a CBP-assigned number is
      // not a tax identifier, so it is never sent to the matcher as one.
      const taxId = entity.taxIdentifierType === "CBP_ASSIGNED" ? null : entity.taxIdentifier;

      try {
        const resolved = await withAccountIdContext(entity.accountId, () =>
          resolvePartyForCompany(actor, {
            legalName: entity.legalName,
            country: entity.country,
            taxId,
            address: entity.addressLine1
              ? {
                  addressLine1: entity.addressLine1,
                  addressLine2: entity.addressLine2,
                  city: entity.city,
                  stateProvince: entity.stateProvince,
                  postalCode: entity.postalCode,
                  country: entity.country,
                }
              : null,
          })
        );

        if (resolved.outcome === "CANDIDATES") {
          needsReview += 1;
          console.log(
            JSON.stringify({
              legalEntityId: entity.id,
              accountId: entity.accountId,
              legalName: entity.legalName,
              action: "NEEDS_MANUAL_REVIEW",
              matchStatus: resolved.status,
              candidatePartyIds: resolved.candidates.map((c) => c.partyId),
            })
          );
          continue;
        }

        if (resolved.outcome === "EXACT") linked += 1;
        else created += 1;

        if (APPLY) {
          await withAccountIdContext(entity.accountId, () =>
            db.legalEntity.updateMany({
              where: { id: entity.id, accountId: entity.accountId, partyId: null },
              data: { partyId: resolved.partyId },
            })
          );
        }

        console.log(
          JSON.stringify({
            legalEntityId: entity.id,
            accountId: entity.accountId,
            legalName: entity.legalName,
            action: APPLY ? (resolved.outcome === "EXACT" ? "LINKED" : "CREATED") : `WOULD_${resolved.outcome === "EXACT" ? "LINK" : "CREATE"}`,
            partyId: resolved.partyId,
          })
        );
      } catch (error) {
        failed += 1;
        console.error(
          JSON.stringify({
            legalEntityId: entity.id,
            accountId: entity.accountId,
            action: "FAILED",
            error: error instanceof Error ? error.message : String(error),
          })
        );
      }
    }

    console.log(
      JSON.stringify({ summary: true, mode: APPLY ? "APPLY" : "DRY_RUN", scanned: legalEntities.length, created, linked, needsReview, failed })
    );
  });

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
