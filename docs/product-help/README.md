# Product-help generation and release

Qubere keeps customer-facing how-to content as a reviewed, versioned corpus. Hand-authored guides live in `supportContent.ts`; release-generated updates live in `generatedProductHelp.json`. The application merges both by stable article id, allowing a reviewed generated article to update a baseline guide without rewriting the hand-authored source.

## Release lifecycle

1. A PR is merged to `main`.
2. `.github/workflows/product-help-release.yml` scans the exact merged diff.
3. If user-facing behavior changed, Gemini proposes only the affected Q&A updates.
4. The workflow validates ids, modules, routes, evidence paths, and archive operations.
5. A documentation PR is opened with the proposed corpus overlay and a release review note.
6. A person verifies the product instructions and merges the documentation PR.
7. The workflow publishes the now-approved corpus and embeddings to `ProductHelpArticle`.

The generator never writes to Postgres. `sync:product-help` never invents content. This keeps generation automatic while publication remains reviewable and auditable.

## Commands

Run commands from the repository root.

```bash
# See whether a commit range contains customer-facing product evidence.
npm run product-help:report -- --base <base-sha> --head <head-sha>

# Generate and print proposed Q&A changes without editing files.
npm run product-help:generate -- --base <base-sha> --head <head-sha>

# Write the generated overlay and release review note.
npm run product-help:generate -- --base <base-sha> --head <head-sha> --write

# Validate the complete merged corpus, generated overlays, archives, and links.
npm --workspace @qubere/custom run typecheck:product-help
npm run product-help:validate

# Run the support-center regression tests.
npm --workspace @qubere/custom test -- --run tests/support-center.test.ts

# Apply database migrations to the database selected by the root environment.
npx prisma migrate deploy --schema packages/db/prisma/schema.prisma

# Publish reviewed Q&A and refresh changed embeddings.
npm run product-help:sync
```

`generate` requires `GEMINI_API_KEY` only when the range contains relevant product changes. `sync` requires the target `DATABASE_URL` and uses `GEMINI_API_KEY` for production embeddings.

## GitHub setup

Create a repository Actions secret for generation:

- `GEMINI_API_KEY`: key used for documentation generation and embeddings.

Create a protected GitHub environment named `demo` with:

- `PRODUCT_HELP_DATABASE_URL`: runtime PostgreSQL URL for the demo database.
- `PRODUCT_HELP_DIRECT_URL`: direct PostgreSQL URL for the same logical database, if required by the environment.
- Optional repository variable `PRODUCT_HELP_GENERATION_MODEL`.

Repository Actions settings must allow GitHub Actions to create and approve pull requests. Keep normal branch protection on `main`; the generated documentation PR should receive the same review as product code.
