/**
 * Temporary same-origin preview for a Cloudflare Quick Tunnel.
 * Run only with local test data and a sandbox provider. Never use this in production.
 */
import { createServer, request as httpRequest } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";

const apiEnv = readFileSync(new URL("../apps/api/.env", import.meta.url), "utf8");
const setting = (name) => apiEnv.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const database = new URL(setting("DATABASE_URL"));
if (
  setting("DIDIT_MODE") !== "sandbox" ||
  !["localhost", "127.0.0.1"].includes(database.hostname) ||
  setting("BRONZE_POLICY_URL") !== "http://localhost:3000/privacy/verification"
) {
  throw new Error(
    "Public preview requires local Postgres, Didit sandbox, and the local Bronze privacy notice.",
  );
}

const username = "kinkord-preview";
const password = process.env.PREVIEW_PASSWORD || randomBytes(18).toString("base64url");
const publicAccess = process.env.PREVIEW_PUBLIC === "1";
const expected = Buffer.from(`Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`);
const upstreams = {
  web: { port: 3000 },
  api: { port: 4000 },
  media: { port: 9000 },
};

function authorized(header) {
  if (typeof header !== "string") return false;
  const supplied = Buffer.from(header);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function publicOrigin(req) {
  const host = req.headers.host;
  if (typeof host !== "string" || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return null;
  const protocol = /^localhost(?::|$)|^127\.0\.0\.1(?::|$)/i.test(host) ? "http" : "https";
  return `${protocol}://${host}`;
}

const server = createServer((req, res) => {
  const origin = publicOrigin(req);
  if (!origin) {
    res.writeHead(400).end();
    return;
  }

  if (!publicAccess && !authorized(req.headers.authorization)) {
    res
      .writeHead(401, {
        "WWW-Authenticate": 'Basic realm="Kinkord test preview", charset="UTF-8"',
        "Cache-Control": "no-store",
      })
      .end("Preview access required");
    return;
  }

  // Browser requests must originate from this preview, not another website.
  if (req.headers.origin && req.headers.origin !== origin) {
    res.writeHead(403).end("Cross-origin request refused");
    return;
  }

  const url = req.url || "/";
  const api = url.startsWith("/__api/");
  const media = url.startsWith("/__media/");
  const target = api ? upstreams.api : media ? upstreams.media : upstreams.web;
  const path = api ? url.slice("/__api".length) : media ? url.slice("/__media".length) : url;
  // MinIO signs the original localhost:9000 Host header into presigned URLs.
  const headers = { ...req.headers, host: media ? "localhost:9000" : `127.0.0.1:${target.port}` };
  delete headers.connection;
  delete headers["proxy-connection"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  if (api) {
    headers.origin = "http://localhost:3000";
    if (headers.referer) headers.referer = "http://localhost:3000/";
    headers["accept-encoding"] = "identity";
    delete headers.authorization;
  }
  if (media) {
    delete headers.authorization;
    delete headers.cookie;
    delete headers.origin;
  }

  const upstream = httpRequest(
    { hostname: "127.0.0.1", port: target.port, method: req.method, path, headers },
    (upstreamRes) => {
      const responseHeaders = { ...upstreamRes.headers };
      delete responseHeaders.connection;
      const contentType = String(responseHeaders["content-type"] || "");
      if (!api || !contentType.includes("application/json")) {
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
        upstreamRes.pipe(res);
        return;
      }

      const chunks = [];
      let size = 0;
      upstreamRes.on("data", (chunk) => {
        size += chunk.length;
        if (size > 5_000_000) upstreamRes.destroy(new Error("API response too large for preview"));
        else chunks.push(chunk);
      });
      upstreamRes.on("end", () => {
        const body = Buffer.concat(chunks)
          .toString("utf8")
          .replaceAll("http://localhost:9000/", `${origin}/__media/`)
          .replaceAll("http://127.0.0.1:9000/", `${origin}/__media/`)
          .replaceAll("http://localhost:4000/", `${origin}/__api/`)
          .replaceAll("http://localhost:3000/", `${origin}/`);
        delete responseHeaders.etag;
        delete responseHeaders["transfer-encoding"];
        responseHeaders["content-length"] = String(Buffer.byteLength(body));
        responseHeaders["cache-control"] = "no-store";
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders).end(body);
      });
      upstreamRes.on("error", () => {
        if (!res.headersSent) res.writeHead(502).end();
      });
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502).end("Preview upstream unavailable");
  });
  req.pipe(upstream);
});

server.listen(3100, "127.0.0.1", () => {
  console.log(
    `Kinkord ${publicAccess ? "public" : "protected"} local preview: http://127.0.0.1:3100`,
  );
  if (!publicAccess) {
    console.log(`Preview username: ${username}`);
    console.log(`Preview password: ${password}`);
  }
  console.log("Share only with designated testers. Stop the process to revoke access.");
});
