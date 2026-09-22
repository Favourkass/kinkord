/**
 * Provision Kinkord's linear Bronze workflow in a Didit application.
 * Run with: node --env-file=apps/api/.env scripts/provision-didit-bronze-workflow.mjs dry-run|inspect|create sandbox|live
 * The environment defaults to sandbox. Live creation must be requested explicitly.
 * The API key is read only from the environment and is never logged.
 */

const baseUrl = "https://verification.didit.me/v3/workflows/";
const mode = process.argv[2] ?? "dry-run";
const environment = process.argv[3] ?? "sandbox";
const label = environment === "live" ? "Kinkord Bronze - Nigeria Live" : "Kinkord Bronze - Nigeria Test";
const apiKey = (environment === "live" ? process.env.DIDIT_API_KEY : process.env.DIDIT_SANDBOX_API_KEY)?.trim();

if (!['dry-run', 'inspect', 'create'].includes(mode)) throw new Error("Use dry-run, inspect or create.");
if (!['sandbox', 'live'].includes(environment)) throw new Error("Use sandbox or live as the environment.");

const payload = {
  workflow_label: label,
  status: "published",
  is_default: false,
  is_desktop_allowed: true,
  session_expiration_time: 86400,
  features: [
    {
      feature: "OCR",
      config: {
        is_age_restrictions_enabled: true,
        minimum_age: 18,
        minimum_age_action: "DECLINE",
        duplicated_user_action: "REVIEW",
      },
    },
    {
      feature: "LIVENESS",
      config: { face_liveness_method: "ACTIVE_3D" },
    },
    { feature: "FACE_MATCH" },
    {
      feature: "DATABASE_VALIDATION",
      config: {
        database_validation_countries: {
          NGA: { services: ["nga_national_id"] },
        },
        database_validation_partial_match_action: "REVIEW",
        database_validation_no_match_action: "DECLINE",
        // Other countries do not have this Nigerian registry check. Kinkord's
        // backend still requires a NIN/BVN match for a Nigerian Bronze award.
        database_validation_not_applicable_action: "NO_ACTION",
      },
    },
  ],
};

async function request(url, options = {}) {
  const response = await fetch(url, {
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
    // Provider error bodies can include echoed credentials or sensitive data.
    const detail = JSON.stringify(body ?? {}).replaceAll(apiKey, "[redacted]").slice(0, 2000);
    throw new Error(`Didit workflow request failed with HTTP ${response.status}: ${detail}`);
  }
  return body;
}

if (mode === "dry-run") {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

if (!apiKey) throw new Error(environment === "live" ? "DIDIT_API_KEY is missing." : "DIDIT_SANDBOX_API_KEY is missing.");

function workflowRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.workflows)) return body.workflows;
  throw new Error("Unexpected Didit workflow-list response.");
}

const current = workflowRows(await request(baseUrl));
const existing = current.filter((item) => item.workflow_label === label);

if (mode === "inspect") {
  console.log(JSON.stringify({
    workflowCount: current.length,
    environment,
    workflows: current.map((item) => ({
      id: item.uuid ?? item.workflow_id,
      label: item.workflow_label,
      status: item.status,
      features: item.features,
    })),
    planned: payload,
  }, null, 2));
} else {
  if (existing.length > 1) throw new Error("Multiple matching workflows exist; inspect them before creating another.");
  const created = existing[0] ?? await request(baseUrl, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const id = created.uuid ?? created.workflow_id;
  if (typeof id !== "string" || !id) throw new Error("Didit did not return a workflow ID.");
  const detail = await request(`${baseUrl}${encodeURIComponent(id)}/`);
  const graphNodes = Object.values(detail.workflow_graph?.nodes ?? {});
  const featureNodes = graphNodes.filter((node) => node?.node_type === "feature");
  const orderedFeatures = payload.features.map((item) => item.feature);
  if (orderedFeatures.some((feature) => !featureNodes.some((node) => node.feature === feature))) {
    throw new Error(`Didit created workflow ${id}, but its returned graph is missing a required feature.`);
  }
  const liveness = featureNodes.find((node) => node.feature === "LIVENESS");
  const validation = featureNodes.find((node) => node.feature === "DATABASE_VALIDATION");
  const nigeriaServices = validation?.config?.database_validation_countries?.NGA?.services ?? [];
  if (liveness?.config?.face_liveness_method !== "ACTIVE_3D" ||
      !nigeriaServices.includes("nga_national_id")) {
    throw new Error(`Didit created workflow ${id}, but active liveness or Nigerian NIN validation did not persist.`);
  }
  console.log(JSON.stringify({
    created: existing.length === 0,
    environment,
    id,
    label: detail.workflow_label,
    status: detail.status,
    features: detail.features,
    isDesktopAllowed: detail.is_desktop_allowed,
    livenessMethod: liveness.config.face_liveness_method,
    nigeriaServices,
  }, null, 2));
}
