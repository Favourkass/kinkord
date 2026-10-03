import { lookup } from "node:dns/promises";
import { get } from "node:https";

// The same cap as an avatar upload (profiles.service), so every valid avatar can be checked.
export const VERIFICATION_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export interface VerificationImage {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

/** Do not rely solely on user-controlled upload MIME metadata. */
export function verificationImage(bytes: Buffer): VerificationImage {
  if (!bytes.length || bytes.length > VERIFICATION_IMAGE_MAX_BYTES)
    throw new Error("Invalid verification image size");
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])))
    return { bytes, contentType: "image/jpeg", extension: "jpg" };
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { bytes, contentType: "image/png", extension: "png" };
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
    return { bytes, contentType: "image/webp", extension: "webp" };
  throw new Error("Unsupported verification image");
}

/** IPv4-only egress: reject private, local, link-local, multicast and reserved ranges. */
export function publicImageAddress(address: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(address)) return false;
  const [a, b, c, d] = address.split(".").map(Number);
  if ([a, b, c, d].some((n) => n < 0 || n > 255)) return false;
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/** Only call with a URL from an authenticated Didit decision, never request input.
 * DNS is resolved once and pinned to public IPv4; no redirects, cookies or API keys.
 * Signed URL and image bytes remain in memory and are never logged or persisted.
 */
export async function downloadVerificationImage(value: string): Promise<VerificationImage> {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443"))
    throw new Error("Unsafe verification image URL");
  const addresses = await lookup(url.hostname, { family: 4, all: true });
  if (!addresses.length || addresses.some((item) => !publicImageAddress(item.address)))
    throw new Error("Unsafe verification image address");
  return new Promise((resolve, reject) => {
    const request = get(
      {
        hostname: addresses[0].address,
        servername: url.hostname,
        port: 443,
        path: url.pathname + url.search,
        headers: { Host: url.hostname, Accept: "image/*" },
        signal: AbortSignal.timeout(10000),
      },
      (response) => {
        if (
          response.statusCode !== 200 ||
          Number(response.headers["content-length"] ?? 0) > VERIFICATION_IMAGE_MAX_BYTES
        ) {
          response.destroy();
          reject(new Error("Verification image unavailable"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > VERIFICATION_IMAGE_MAX_BYTES) {
            response.destroy(new Error("Verification image too large"));
            return;
          }
          chunks.push(chunk);
        });
        response.on("error", () => reject(new Error("Verification image unavailable")));
        response.on("end", () => {
          try {
            resolve(verificationImage(Buffer.concat(chunks)));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    request.on("error", () => reject(new Error("Verification image unavailable")));
  });
}
