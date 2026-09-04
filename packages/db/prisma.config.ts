import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 6.19's package.json#prisma config block is deprecated (removed in
// Prisma 7), so this package uses the newer prisma.config.ts entrypoint
// instead. Schema/migrations live under ./prisma relative to this file
// (packages/db), independent of whichever workspace's cwd invokes the CLI.
//
// Presence of this file disables Prisma's automatic .env loading, so we
// load the repo-root .env ourselves to keep DATABASE_URL/DIRECT_URL
// available regardless of which workspace's shell invokes the CLI.
loadEnv({ path: path.join(__dirname, "..", "..", ".env") });

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: {
    path: path.join(__dirname, "prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
});
