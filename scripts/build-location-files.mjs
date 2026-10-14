#!/usr/bin/env node
/**
 * Builds the place lists signup and Edit Profile offer: one file per Nigerian
 * state and Kenyan county, apps/web/public/locations/<CC>/<slug>.json, which
 * the app fetches only once someone picks that state, plus the short list of
 * state and county names it bundles (apps/web/src/constants/location-states.json).
 *
 * Inputs, in scripts/data:
 *   location-options.json    GeoNames places per state/county (see location-data-sources.json)
 *   ng-curated-areas.json    the areas signup offered before, so members' saved ones stay listed
 *
 * Run `node scripts/build-location-files.mjs` after changing either, and commit the output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "scripts/data");
export const OUT_DIR = path.join(ROOT, "apps/web/public/locations");
export const STATES_FILE = path.join(ROOT, "apps/web/src/constants/location-states.json");

const COUNTRY_NAMES = { NG: "Nigeria", KE: "Kenya" };

/** GeoNames records filed under the wrong county or state. */
export const MISFILED = {
  KE: { Migori: ["Kibera Kichinjio", "Mathare North Area 4"], "Elgeyo-Marakwet": ["Githurai"] },
  NG: { "Cross River": ["Nyanya"] },
};

/** Well-known places GeoNames lacks (or files elsewhere). */
export const ADDED = {
  KE: {
    Nairobi: [
      "South B",
      "South C",
      "Donholm",
      "Buruburu",
      "Lavington",
      "Lang'ata",
      "Kibera",
      "Mathare",
      "Githurai",
    ],
    Machakos: ["Syokimau"],
  },
  NG: {
    "FCT Abuja": ["Life Camp", "Nyanya"],
    Lagos: ["Victoria Island"],
    Oyo: ["Bodija"],
  },
};

/** The file a state's list lives in: "Akwa Ibom" → "akwa-ibom". Mirrors locationSlug in the web app. */
export function locationSlug(state) {
  return state
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘'`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Spelling aside (accents, apostrophes, hyphens, spaces, case), the same place: "Buru Buru". */
export function placeKey(name) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘'`\s-]/g, "")
    .toLowerCase();
}

const FACILITY =
  /\b(school|college|university|polytechnic|academy|hospital|clinic|dispensary|health cent(?:re|er)|market|church|cathedral|mosque|station|barracks|camp|prison|police)\b/i;

/** A GeoNames record nobody would call home: a stub, a numbered plot, a facility or an address. */
export function isJunkPlace(name, country) {
  const letters = name.replace(/[^\p{L}]/gu, "").length;
  const countryName = COUNTRY_NAMES[country];
  return (
    letters <= 2 ||
    /\d/.test(name) ||
    FACILITY.test(name) ||
    name.includes(",") ||
    (countryName !== undefined && new RegExp(`\\b${countryName}\\b`, "i").test(name))
  );
}

const byName = (a, b) => a.localeCompare(b);

/** "Umoja 1" → "Umoja", "South ’B’" → "South B": a numbered part of a place is the place. */
export function tidyPlace(name) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[‘’]([A-Za-z])[‘’]/g, "$1")
    .replace(/\s+(?:(?:no\.?|phase|area)\s*)?\(?\d+\)?$/i, "");
}

/** Where two spellings of a place meet, the first list's is kept. */
function mergePlaces(...lists) {
  const seen = new Set();
  const out = [];
  for (const raw of lists.flat()) {
    const name = raw.trim().replace(/\s+/g, " ");
    const key = placeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out.sort(byName);
}

/**
 * { states: { NG: [...names] }, files: { "NG/akwa-ibom": [...places] } } from the
 * GeoNames lists and the curated Nigerian areas.
 */
export function buildLocations(places, curated) {
  const states = {};
  const files = {};
  for (const [country, byState] of Object.entries(places)) {
    states[country] = Object.keys(byState).sort(byName);
    for (const state of states[country]) {
      const misfiled = new Set((MISFILED[country]?.[state] ?? []).map(placeKey));
      const geonames = byState[state]
        .filter((name) => !misfiled.has(placeKey(name)))
        .map(tidyPlace)
        .filter((name) => !isJunkPlace(name, country));
      const file = `${country}/${locationSlug(state)}`;
      if (file in files) throw new Error(`Two places share ${file}.json`);
      // The spellings members saved come first, then ours, then GeoNames'.
      files[file] = mergePlaces(
        country === "NG" ? (curated[state] ?? []) : [],
        ADDED[country]?.[state] ?? [],
        geonames,
      );
    }
  }
  for (const state of Object.keys(curated))
    if (!states.NG?.includes(state)) throw new Error(`Curated areas for unknown state ${state}`);
  return { states, files };
}

export function readInputs(dir = DATA_DIR) {
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  return { places: read("location-options.json"), curated: read("ng-curated-areas.json") };
}

function main() {
  const { places, curated } = readInputs();
  const { states, files } = buildLocations(places, curated);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  for (const [file, list] of Object.entries(files)) {
    const target = path.join(OUT_DIR, `${file}.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(list)}\n`);
  }
  fs.writeFileSync(STATES_FILE, `${JSON.stringify(states, null, 2)}\n`);
  const total = Object.values(files).reduce((sum, list) => sum + list.length, 0);
  console.log(`Wrote ${Object.keys(files).length} place lists (${total} places).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
