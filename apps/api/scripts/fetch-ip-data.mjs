#!/usr/bin/env node
/**
 * Downloads DB-IP's free IP-to-country and IP-to-network (ASN) files into
 * data/ip, for the country check (src/location-check). The API image runs
 * this at build time so each deploy carries the latest month's data; the API
 * fetches them itself at start when they're missing. Locally, build the API
 * first (`pnpm --filter api build`), then run this once before trying the
 * check with LOCATION_CHECK_DEV_IP.
 *
 * IP Geolocation by DB-IP (https://db-ip.com), CC BY 4.0.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { fetchIpData } = createRequire(import.meta.url)(
  join(root, "dist/location-check/ip-data.js"),
);
await fetchIpData(process.env.LOCATION_DATA_DIR ?? join(root, "data", "ip"), {
  log: (line) => console.log(line),
});
