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

const { places, curated } = readInputs();
const built = buildLocations(places, curated);
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
