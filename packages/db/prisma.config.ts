import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 6.19's package.json#prisma config block is deprecated (removed in
// Prisma 7), so this package uses the newer prisma.config.ts entrypoint
// instead. Schema/migrations live under ./prisma relative to this file
// (packages/db), independent of whichever workspace's cwd invokes the CLI.
export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  migrations: {
    path: path.join(__dirname, "prisma", "migrations"),
    seed: "npx tsx prisma/seed.ts",
  },
});
