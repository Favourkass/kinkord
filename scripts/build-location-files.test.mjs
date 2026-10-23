import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  ADDED,
  OUT_DIR,
  STATES_FILE,
  buildLocations,
  isJunkPlace,
  locationSlug,
  placeKey,
  readInputs,
  tidyPlace,
} from "./build-location-files.mjs";

const { places, curated, requested } = readInputs();
const built = buildLocations(places, curated, requested);
const list = (country, state) => built.files[`${country}/${locationSlug(state)}`];

test("the committed place lists are exactly what the generator builds", () => {
  assert.deepEqual(JSON.parse(fs.readFileSync(STATES_FILE, "utf8")), built.states);
  const onDisk = fs
    .readdirSync(OUT_DIR)
    .flatMap((country) =>
      fs
        .readdirSync(path.join(OUT_DIR, country))
        .map((f) => `${country}/${f.replace(/\.json$/, "")}`),
    );
  assert.deepEqual(onDisk.sort(), Object.keys(built.files).sort());
  for (const [file, places] of Object.entries(built.files))
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(OUT_DIR, `${file}.json`), "utf8")),
      places,
    );
});

test("every list is sorted, deduplicated and free of junk", () => {
  assert.equal(built.states.NG.length, 37);
  assert.equal(built.states.KE.length, 47);
  // Curated and added names are kept as written ("Mile 2", "Life Camp").
  const chosen = new Set([
    ...Object.values(curated).flat(),
    ...Object.values(requested).flatMap((byState) => Object.values(byState).flat()),
    ...Object.values(ADDED).flatMap((byState) => Object.values(byState).flat()),
  ]);
  for (const [file, names] of Object.entries(built.files)) {
    const country = file.slice(0, 2);
    assert.deepEqual(
      names,
      [...names].sort((a, b) => a.localeCompare(b)),
      file,
    );
    assert.equal(new Set(names.map(placeKey)).size, names.length, `${file} has duplicates`);
    for (const name of names)
      assert.ok(chosen.has(name) || !isJunkPlace(name, country), `${file}: ${name}`);
    assert.ok(!names.includes("My region is not listed"), file);
  }
});

test("keeps every area members could pick before, spelled as they saved it", () => {
  assert.equal(Object.values(curated).flat().length, 764);
  for (const [state, names] of Object.entries(curated))
    for (const name of names) assert.ok(list("NG", state).includes(name), `${state}: ${name}`);
  // Older picks that the GeoNames lists lacked.
  assert.ok(list("NG", "Abia").includes("Ikwuano"));
  assert.ok(list("NG", "Lagos").includes("Mile 2"));
});

test("moves misfiled places and adds well-known ones", () => {
  assert.ok(!list("KE", "Migori").some((n) => /kibera|mathare/i.test(n)));
  assert.ok(!list("KE", "Elgeyo-Marakwet").includes("Githurai"));
  assert.ok(!list("NG", "Cross River").includes("Nyanya"));
  for (const name of ["South B", "South C", "Donholm", "Buruburu", "Lavington", "Lang'ata"])
    assert.ok(list("KE", "Nairobi").includes(name), name);
  for (const name of ["Kibera", "Mathare", "Githurai", "Umoja"])
    assert.ok(list("KE", "Nairobi").includes(name), name);
  assert.ok(list("NG", "FCT Abuja").includes("Life Camp"));
  assert.ok(list("NG", "FCT Abuja").includes("Nyanya"));
  assert.ok(list("NG", "Lagos").includes("Victoria Island"));
  assert.ok(list("NG", "Oyo").includes("Bodija"));
  assert.ok(list("KE", "Machakos").includes("Syokimau"));
});

test("tells places from facilities, stubs and addresses", () => {
  for (const junk of ["Gu", "Mbak 1", "Oye Market", "Kapkures Primary School", "Ijaw Fishing Camp"])
    assert.ok(isJunkPlace(junk, "NG"), junk);
  assert.ok(isJunkPlace("Isieke, Isiekenesi, Imo,Nigeria", "NG"));
  assert.ok(isJunkPlace("Bomas of Kenya", "KE"));
  for (const place of ["Aba", "Victoria Island", "Campbell Estate", "Stationside"])
    assert.ok(!isJunkPlace(place, "NG"), place);
  assert.equal(tidyPlace("Umoja 1"), "Umoja");
  assert.equal(tidyPlace("Dandora Phase 4"), "Dandora");
  assert.equal(tidyPlace("South ’B’"), "South B");
  assert.equal(locationSlug("Akwa Ibom"), "akwa-ibom");
  assert.equal(locationSlug("Murang’a"), "muranga");
  assert.equal(placeKey("Buru Buru"), placeKey("Buruburu"));
});

test("includes all requested South Dakota and Tennessee towns", () => {
  const requested = {
    "South Dakota": [
      "Aberdeen",
      "Belle Fourche",
      "Brandon",
      "Brookings",
      "Canton",
      "Chamberlain",
      "Dell Rapids",
      "Harrisburg",
      "Hot Springs",
      "Huron",
      "Lead",
      "Madison",
      "Milbank",
      "Mitchell",
      "Mobridge",
      "North Sioux City",
      "Pierre",
      "Rapid City",
      "Redfield",
      "Sioux Falls",
      "Spearfish",
      "Sturgis",
      "Tea",
      "Vermillion",
      "Watertown",
      "Yankton",
      "Winner",
      "Box Elder",
      "Fort Pierre",
      "Gregory",
      "Hill City",
      "Kimball",
      "Lennox",
      "Miller",
      "Parkston",
      "Philip",
      "Springfield",
      "Summerset",
      "Tyndall",
      "Volga",
    ],
    Tennessee: [
      "Alcoa",
      "Athens",
      "Bartlett",
      "Brentwood",
      "Bristol",
      "Brownsville",
      "Chattanooga",
      "Clarksville",
      "Cleveland",
      "Collierville",
      "Columbia",
      "Cookeville",
      "Dyersburg",
      "Elizabethton",
      "Farragut",
      "Franklin",
      "Gallatin",
      "Germantown",
      "Greeneville",
      "Hendersonville",
      "Jackson",
      "Johnson City",
      "Kingsport",
      "Knoxville",
      "La Vergne",
      "Lebanon",
      "Maryville",
      "Memphis",
      "Morristown",
      "Mount Juliet",
      "Murfreesboro",
      "Oak Ridge",
      "Paris",
      "Sevierville",
      "Shelbyville",
      "Smyrna",
      "Spring Hill",
    ],
  };
  for (const [state, towns] of Object.entries(requested))
    for (const town of towns) assert.ok(list("US", state).includes(town), `${state}: ${town}`);
  assert.equal(built.states.GH.length, 16);
  assert.equal(built.states.US.length, 51);
  for (const state of [...built.states.GH, ...built.states.US]) assert.ok(state.length > 0);
});

test("preserves every supplied USA and Ghana name exactly in its requested group", () => {
  assert.equal(Object.keys(requested.GH).length, 16);
  assert.equal(Object.values(requested.GH).flat().length, 320);
  assert.equal(Object.keys(requested.US).length, 31);
  assert.equal(Object.values(requested.US).flat().length, 1233);
  for (const [country, byState] of Object.entries(requested))
    for (const [state, names] of Object.entries(byState))
      for (const name of names)
        assert.equal(
          list(country, state).filter((value) => value === name).length,
          1,
          `${country}/${state}: ${name}`,
        );
});

test("retains supplied short names, punctuation, capitalization and alternate groupings", () => {
  for (const [country, state, name] of [
    ["GH", "Upper West", "Wa"],
    ["GH", "Upper West", "Ko"],
    ["GH", "Volta", "Ho"],
    ["GH", "Central", "Elmina"],
    ["GH", "Ahafo", "Akwasiase"],
    ["GH", "Greater Accra", "Kasoa"],
    ["GH", "Central", "Kasoa"],
    ["GH", "Bono", "Kintampo"],
    ["GH", "Bono East", "Kintampo"],
    ["US", "Alaska", "Barrow (Utqiagvik)"],
    ["US", "Utah", "St. George"],
    ["US", "New Mexico", "Española"],
    ["US", "District of Columbia", "NoMa"],
    ["US", "District of Columbia", "U Street"],
  ])
    assert.ok(list(country, state).includes(name), `${state}: ${name}`);
});

test("retains additional existing towns and leaves countries without overrides unchanged", () => {
  const original = buildLocations(places, curated);
  for (const [file, names] of Object.entries(original.files)) {
    if (!file.startsWith("GH/") && !file.startsWith("US/")) {
      assert.deepEqual(built.files[file], names);
    } else {
      const keys = new Set(built.files[file].map(placeKey));
      for (const name of names) assert.ok(keys.has(placeKey(name)), `${file}: ${name}`);
    }
  }
});

test("rejects a misspelled requested region instead of silently dropping it", () => {
  assert.throws(
    () => buildLocations(places, curated, { GH: { Unknown: ["Town"] } }),
    /unknown subdivision GH\/Unknown/,
  );
});
