/**
 * Select Kinkord's published live workflow, register the production webhook,
 * and write the resulting identifiers to the ignored API environment file.
 * Secrets are never printed.
 *
 * Run with: node --env-file=apps/api/.env scripts/configure-didit-live.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const apiBase = "https://verification.didit.me/v3";
const envPath = "apps/api/.env";
const workflowLabel = "Kinkord KYC - Nigeria Live";
const webhookLabel = "Kinkord Production API";
const webhookUrl = "https://api.kinkord.com/webhooks/didit";
const apiKey = process.env.DIDIT_API_KEY?.trim();

if (!apiKey) throw new Error("DIDIT_API_KEY is missing.");

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "x-api-key": apiKey,
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = JSON.stringify(body ?? {}).replaceAll(apiKey, "[redacted]").slice(0, 2000);
    throw new Error(`Didit request failed with HTTP ${response.status}: ${detail}`);
  }
  return body;
}

function rows(body, key) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.[key])) return body[key];
  throw new Error(`Unexpected Didit ${key} response.`);
}

function setEnv(source, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  if (pattern.test(source)) return source.replace(pattern, line);
  return `${source.replace(/\s*$/, "")}\n${line}\n`;
}

const workflows = rows(await request("/workflows/"), "workflows");
const matches = workflows.filter(
  (workflow) => workflow.workflow_label === workflowLabel && workflow.status === "published",
);
if (matches.length !== 1) {
  throw new Error(`Expected exactly one published ${workflowLabel} workflow; found ${matches.length}.`);
}
const workflow = matches[0];
const workflowId = workflow.uuid ?? workflow.workflow_id;
if (typeof workflowId !== "string" || !workflowId) throw new Error("Didit workflow ID is missing.");

const listedDestinations = rows(await request("/webhook/destinations/"), "destinations");
const matchingDestinations = listedDestinations.filter(
  (destination) => destination.url === webhookUrl,
);
if (matchingDestinations.length > 1) {
  throw new Error(`Multiple webhook destinations target ${webhookUrl}; resolve duplicates first.`);
}
const destinationSummary = matchingDestinations[0] ?? await request("/webhook/destinations/", {
  method: "POST",
  body: JSON.stringify({
    label: webhookLabel,
    url: webhookUrl,
    enabled: true,
    webhook_version: "v3",
    subscribed_events: ["status.updated", "data.updated"],
  }),
});
const destinationId = destinationSummary.uuid;
if (typeof destinationId !== "string" || !destinationId) {
  throw new Error("Didit webhook destination ID is missing.");
}
const destination = await request(`/webhook/destinations/${encodeURIComponent(destinationId)}/`);
const webhookSecret = destination.secret_shared_key ?? destination.secret;
if (typeof webhookSecret !== "string" || !webhookSecret) {
  throw new Error("Didit did not return the webhook signing secret.");
}

let env = readFileSync(envPath, "utf8");
env = setEnv(env, "DIDIT_MODE", "live");
env = setEnv(env, "DIDIT_LIVE_WORKFLOW_ID", workflowId);
env = setEnv(env, "DIDIT_WEBHOOK_SECRET", webhookSecret);
writeFileSync(envPath, env, { encoding: "utf8", mode: 0o600 });

console.log(JSON.stringify({
  workflowConfigured: true,
  workflowLabel,
  workflowFeatures: workflow.features,
  webhookConfigured: true,
  webhookCreated: !matchingDestinations[0],
  webhookUrl,
  webhookVersion: destination.webhook_version,
  webhookEnabled: destination.enabled,
  secretStored: true,
}, null, 2));
