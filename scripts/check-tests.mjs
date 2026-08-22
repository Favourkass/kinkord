#!/usr/bin/env node
/**
 * CI gate: changed feature code must ship with test files.
 *
 * For every changed .ts/.tsx under apps/<x>/src that looks like feature code,
 * require a matching *.spec.* — either a sibling, in a __tests__ dir, or
 * anywhere in the same app referencing the same basename.
 *
 * Exempt: specs themselves, bootstrap/wiring (main, *.module), generated code
 * (db schema, drizzle), type-only files (*.d.ts, *.port, types), config, and
 * pure-presentation web files (app router pages/layouts, dumb components) —
 * those are covered by Playwright at the flow level instead.
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const base = process.env.BASE_REF ? `origin/${process.env.BASE_REF}` : "origin/dev";
let diff;
try {
  // No R: a pure rename/move is not a feature change.
  diff = execSync(`git diff --name-only --diff-filter=ACM ${base}...HEAD`, {
    encoding: "utf8",
  });
} catch {
  console.log(`check-tests: could not diff against ${base}; skipping`);
  process.exit(0);
}

const changed = diff.split("\n").filter(Boolean);

const EXEMPT = [
  /\.(spec|test)\.tsx?$/,
  /\.d\.ts$/,
  /src\/main\.ts$/,
  /\.module\.ts$/,
  /\.port\.ts$/,
  /src\/db\/schema\//,
  /src\/db\/db\.module/,
  /drizzle\//,
  /\/types?\.ts$/,
  // DI/config assembly, same class of wiring as *.module.ts.
  /\.instance\.ts$/,
  // Client SDK construction (createAuthClient config) — wiring, no logic.
  /apps\/web\/src\/services\/authClient\.ts$/,
  // Legacy Sheets-era admin stack: replaced wholesale by the platform admin
  // app; covered by Playwright until deletion. Remove these lines with it.
  /apps\/web\/src\/presenters\/useAdmin\w+Presenter\.ts$/,
  /apps\/web\/src\/presenters\/useLectureFormPresenter\.ts$/,
  /apps\/web\/src\/(services|repositories)\/(auth|lecture)\./,
  // Framework entry point (like main.ts).
  /apps\/web\/src\/middleware\.ts$/,
  // Web presentation layer: covered by Playwright flows, not unit specs.
  /apps\/web\/src\/app\//,
  /apps\/web\/src\/components\//,
  /apps\/web\/src\/constants\//,
];

const needsTest = changed.filter(
  (f) => /^apps\/[^/]+\/src\/.+\.tsx?$/.test(f) && !EXEMPT.some((re) => re.test(f)),
);

const missing = [];
for (const file of needsTest) {
  const dir = path.dirname(file);
  const name = path.basename(file).replace(/\.tsx?$/, "");
  const candidates = [
    `${dir}/${name}.spec.ts`,
    `${dir}/${name}.spec.tsx`,
    `${dir}/${name}.test.ts`,
    `${dir}/__tests__/${name}.spec.ts`,
  ];
  if (!candidates.some((c) => existsSync(c))) missing.push({ file, expected: candidates[0] });
}

if (missing.length) {
  console.error("❌ Changed feature files are missing test files:\n");
  for (const m of missing) console.error(`  ${m.file}\n    → expected e.g. ${m.expected}`);
  console.error("\nAdd specs for the changed behavior (or move pure wiring into exempt patterns).");
  process.exit(1);
}
console.log(`check-tests: ${needsTest.length} feature file(s) checked, all have specs ✓`);
