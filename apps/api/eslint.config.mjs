import tseslint from "typescript-eslint";
import unusedImports from "eslint-plugin-unused-imports";

export default tseslint.config(
  { ignores: ["dist/**", "drizzle/**", "node_modules/**", "*.config.*", "ba-cli.config.ts"] },
  ...tseslint.configs.recommended,
  {
    plugins: { "unused-imports": unusedImports },
    rules: {
      // Unused code is an error, not a warning.
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      // NOTE: consistent-type-imports is deliberately NOT enabled here — with
      // emitDecoratorMetadata, type-only imports erase the runtime classes
      // NestJS DI resolves from constructor metadata.
      "no-console": "error",
      eqeqeq: ["error", "smart"],
    },
  },
  {
    // Separation of concerns: controllers orchestrate HTTP only — no direct
    // data-layer or transport-adapter imports; go through services.
    files: ["src/**/*.controller.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/db/**", "**/*.adapter"],
              message: "Controllers must use services, not the data layer or adapters directly.",
            },
          ],
        },
      ],
    },
  },
  {
    // Bootstrap and specs are allowed console/loose ergonomics where needed.
    files: ["src/main.ts"],
    rules: { "no-console": "off" },
  },
);
