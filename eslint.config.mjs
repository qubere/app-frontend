import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import tenantScopedWrite from "./eslint-rules/tenant-scoped-write.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    ".claude/**",
    "fix_decimal*.js",
    "fix_engine.js",
    "scratch/**",
    "apps/custom/tests/test_chat*.js",
    "apps/custom/src/scripts/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    // The filing-config visual editor predates the React compiler lint rules
    // introduced by the current Next.js toolchain. Keep correctness rules such
    // as rules-of-hooks enabled, but do not block production builds on compiler
    // optimization advisories while this legacy editor is migrated.
    files: ["apps/custom/src/app/app/filing-config/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
    },
  },
  {
    files: ["apps/custom/tests/**/*"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Cross-tenant updateMany/deleteMany calls have shipped in apps/tms more
    // than once and only been caught by manual audit passes -- see
    // eslint-rules/tenant-scoped-write.mjs for the exact shape this catches.
    // apps/portal writes to the same shared @qubere/db Prisma client under
    // the same "db"/"tx" naming convention, so it is exposed to the identical
    // bug class and gets the same guard.
    files: ["apps/tms/src/**/*.{ts,tsx}", "apps/portal/src/**/*.{ts,tsx}"],
    plugins: { local: tenantScopedWrite },
    rules: {
      "local/tenant-scoped-write": "error",
    },
  },
]);

export default eslintConfig;
