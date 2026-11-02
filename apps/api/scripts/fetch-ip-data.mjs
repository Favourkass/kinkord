#!/usr/bin/env node
/**
 * Downloads DB-IP's free IP-to-country and IP-to-network (ASN) files into
 * data/ip, for the country check (src/location-check). The API image runs
 * this at build time, so every deploy carries the latest month's data;
 * locally, run it once before trying the check with LOCATION_CHECK_DEV_IP.
 *
 * IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0, credited on the
 * privacy page. No account or key is needed.
 *
 * A new month's files appear early in the month, so this falls back to the
 * month before. It fails when neither can be had: an image without the data
 * would ask every member to retry their check.
 */
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.env.LOCATION_DATA_DIR ?? join(root, "data", "ip");
const FILES = ["dbip-country-lite", "dbip-asn-lite"];
/** Either file is several megabytes; anything this small is an error page. */
const MIN_BYTES = 500_000;

function months(now = new Date()) {
  return [0, 1].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

async function fetchFile(name) {
  for (const month of months()) {
    const url = `https://download.db-ip.com/free/${name}-${month}.mmdb.gz`;
    const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!res.ok) {
      console.warn(`${url}: HTTP ${res.status}`);
      continue;
    }
    const data = gunzipSync(Buffer.from(await res.arrayBuffer()));
    if (data.length < MIN_BYTES) throw new Error(`${url}: only ${data.length} bytes`);
    const target = join(out, `${name}.mmdb`);
    await writeFile(`${target}.part`, data);
    await rename(`${target}.part`, target);
    console.log(`${name}.mmdb: ${month}, ${(data.length / 1e6).toFixed(1)} MB`);
    return;
  }
  throw new Error(`${name}: no file for ${months().join(" or ")}`);
}

await mkdir(out, { recursive: true });
for (const name of FILES) await fetchFile(name);
