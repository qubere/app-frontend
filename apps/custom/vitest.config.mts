import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Increase global test timeout to accommodate long-running integration tests
    // (in milliseconds). Adjust as needed for CI environments.
    testTimeout: 300000, // 5 minutes
    // e2e/*.spec.ts is Playwright's; the default glob would otherwise claim it.
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // This suite validates the persistent Qubere Trade Network demo seed and
    // intentionally resets/repopulates data. It must be invoked explicitly,
    // not as part of the normal isolated unit-test run.
    exclude: ["tests/qubere-trade-network-seed.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
