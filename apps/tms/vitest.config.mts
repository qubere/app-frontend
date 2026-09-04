import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    testTimeout: 300000,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@qubere/billing": path.resolve(__dirname, "../../packages/billing/src"),
      "@qubere/auth": path.resolve(__dirname, "../../packages/auth/src"),
      "@qubere/db": path.resolve(__dirname, "../../packages/db/src"),
    },
  },
});
