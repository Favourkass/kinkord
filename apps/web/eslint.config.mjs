import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import unusedImports from "eslint-plugin-unused-imports";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
    },
  },
  {
    // AGENTS.md layering, machine-enforced.
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**" },
        { type: "components", pattern: "src/components/**" },
        { type: "presenters", pattern: "src/presenters/**" },
        { type: "services", pattern: "src/services/**" },
        { type: "repositories", pattern: "src/repositories/**" },
        { type: "domain", pattern: "src/domain/**" },
        { type: "constants", pattern: "src/constants/**" },
        { type: "util", pattern: "src/util/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          message: "${file.type} may not import ${dependency.type} (AGENTS.md layering)",
          rules: [
            // Screens/route handlers wire everything except each other's internals.
            {
              from: "app",
              allow: [
                "app",
                "components",
                "presenters",
                "services",
                "repositories",
                "domain",
                "constants",
                "util",
              ],
            },
            // Dumb views: props in, callbacks out. Domain types allowed for prop typing.
            { from: "components", allow: ["components", "domain", "util", "presenters"] },
            {
              from: "presenters",
              allow: ["presenters", "services", "domain", "constants", "util"],
            },
            {
              from: "services",
              allow: ["services", "repositories", "domain", "constants", "util"],
            },
            { from: "repositories", allow: ["repositories", "domain", "constants", "util"] },
            { from: "domain", allow: ["domain", "util"] },
            { from: "constants", allow: ["constants", "domain", "util"] },
            { from: "util", allow: ["util"] },
          ],
        },
      ],
    },
  },
  {
    // Components may import presenter *types* for props, never call hooks/functions.
    // (Type-only imports are erased at build; runtime presenter use in components
    // is caught in review — the boundary above blocks everything else.)
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/services/*", "@/repositories/*"],
              message: "Components are dumb: receive data via props (AGENTS.md).",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
