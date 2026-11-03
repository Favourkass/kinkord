import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * DB-IP's free IP-to-country and IP-to-network (ASN) files. Credit them as
 * "IP Geolocation by DB-IP" (CC BY 4.0); the privacy notice does. No account
 * or key is needed.
 */
export const IP_DATA_FILES = ["dbip-country-lite", "dbip-asn-lite"] as const;
/** Either file is several megabytes; anything this small is an error page. */
const MIN_BYTES = 500_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;

/** This month, then last: a new month's files appear a few days into it. */
export function dataMonths(now = new Date()): string[] {
  return [0, 1].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/** A download, tried three times: a passing network blip shouldn't fail a deploy. */
async function download(url: string, log: (line: string) => void, pauseMs: number) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (res.ok || res.status === 404 || attempt === 3) return res;
      log(`${url}: HTTP ${res.status}, trying again`);
    } catch (error) {
      if (attempt === 3) throw error;
      log(`${url}: ${String(error)}, trying again`);
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * pauseMs));
  }
}

/**
 * Downloads both files into `dir` as `<name>.mmdb`. Run when the API image is
 * built (scripts/fetch-ip-data.mjs), and by the API itself when the image came
 * without them or they've gone stale. Throws when neither this month's nor
 * last month's file can be had.
 */
export async function fetchIpData(
  dir: string,
  opts: { now?: Date; log?: (line: string) => void; pauseMs?: number } = {},
): Promise<void> {
  const log = opts.log ?? (() => undefined);
  await mkdir(dir, { recursive: true });
  for (const name of IP_DATA_FILES) {
    let saved = false;
    for (const month of dataMonths(opts.now)) {
      const url = `https://download.db-ip.com/free/${name}-${month}.mmdb.gz`;
      const res = await download(url, log, opts.pauseMs ?? 10_000);
      if (!res.ok) {
        log(`${url}: HTTP ${res.status}`);
        continue;
      }
      const data = gunzipSync(Buffer.from(await res.arrayBuffer()));
      if (data.length < MIN_BYTES) throw new Error(`${url}: only ${data.length} bytes`);
      const target = join(dir, `${name}.mmdb`);
      await writeFile(`${target}.part`, data);
      await rename(`${target}.part`, target);
      log(`${name}.mmdb: ${month}, ${(data.length / 1e6).toFixed(1)} MB`);
      saved = true;
      break;
    }
    if (!saved) throw new Error(`${name}: no file for ${dataMonths(opts.now).join(" or ")}`);
  }
}
