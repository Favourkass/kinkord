/**
 * Creates Kinkord's identity verification workflow ("Bronze") in a Didit
 * application: ID document, active liveness, face match to the ID, and for
 * Nigerian IDs a NIMC lookup (the payload is in didit-bronze-workflow.mjs).
 * Put the returned id in the verification settings (DIDIT_WORKFLOW_ID
 * locally, diditWorkflowId in kinkord/verification).
 *
 * Sandbox may load apps/api/.env. Live never reads a file: it refuses
 * --env-file and asks for the key with the input hidden, so the key stays out
 * of shell history and off disk (DIDIT_LIVE_API_KEY is used if already set).
 * The environment defaults to sandbox; live must be asked for explicitly.
 * The API key is never logged.
 */
import { bronzeWorkflowPayload, workflowDifferences } from "./didit-bronze-workflow.mjs";
import { diditWorkflowApiKey, readHidden, refuseEnvFileForLive } from "./didit-workflow-env.mjs";

const baseUrl = "https://verification.didit.me/v3/workflows/";
const mode = process.argv[2] ?? "dry-run";
const environment = process.argv[3] ?? "sandbox";

if (!["dry-run", "inspect", "create"].includes(mode))
  throw new Error("Use dry-run, inspect or create.");
if (!["sandbox", "live"].includes(environment))
  throw new Error("Use sandbox or live as the environment.");
refuseEnvFileForLive(environment);

const payload = bronzeWorkflowPayload(environment);
const label = payload.workflow_label;

if (mode === "dry-run") {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const apiKey =
  diditWorkflowApiKey(environment) ||
  (environment === "live" ? await readHidden("Didit live API key (input hidden): ") : "");
if (!apiKey)
  throw new Error(
    environment === "live" ? "No live API key was entered." : "DIDIT_SANDBOX_API_KEY is missing.",
  );

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    // A redirect would carry the API key to wherever it points.
    redirect: "error",
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
    const detail = JSON.stringify(body ?? {})
      .replaceAll(apiKey, "[redacted]")
      .slice(0, 2000);
    throw new Error(`Didit workflow request failed with HTTP ${response.status}: ${detail}`);
  }
  return body;
}

function workflowRows(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.workflows)) return body.workflows;
  throw new Error("Unexpected Didit workflow-list response.");
}

/** Every workflow in the application, following Didit's pages. */
async function listWorkflows() {
  const rows = [];
  let url = new URL(baseUrl);
  for (let page = 1; url; page++) {
    if (page > 50) throw new Error("Didit's workflow list didn't end after 50 pages.");
    const body = await request(url);
    rows.push(...workflowRows(body));
    url = body?.next ? new URL(body.next, baseUrl) : null;
    // Each request carries the API key, so only Didit's own pages are followed.
    if (url && url.origin !== new URL(baseUrl).origin)
      throw new Error("Didit's next page is on another site; not sending the key there.");
  }
  return rows;
}

const current = await listWorkflows();
const existing = current.filter((item) => item.workflow_label === label);

if (mode === "inspect") {
  console.log(
    JSON.stringify(
      {
        workflowCount: current.length,
        environment,
        workflows: current.map((item) => ({
          id: item.uuid ?? item.workflow_id,
          label: item.workflow_label,
          status: item.status,
          features: item.features,
        })),
        planned: payload,
      },
      null,
      2,
    ),
  );
} else {
  if (existing.length > 1)
    throw new Error("Multiple matching workflows exist; inspect them before creating another.");
  const created =
    existing[0] ??
    (await request(baseUrl, {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  const id = created.uuid ?? created.workflow_id;
  if (typeof id !== "string" || !id) throw new Error("Didit did not return a workflow ID.");
  const detail = await request(`${baseUrl}${encodeURIComponent(id)}/`);
  const differences = workflowDifferences(payload, detail);
  if (differences.length) {
    const list = differences.map((line) => `\n- ${line}`).join("");
    throw new Error(
      existing.length
        ? `Workflow ${id} ("${label}") differs from this script, so it won't be reused:${list}\n` +
            "Fix it in Didit's console, or rename it there so this script creates a new one."
        : `Didit created workflow ${id}, but these settings didn't persist:${list}`,
    );
  }
  const config = (feature) =>
    Object.values(detail.workflow_graph.nodes).find(
      (node) => node?.node_type === "feature" && node.feature === feature,
    ).config;
  console.log(
    JSON.stringify(
      {
        created: existing.length === 0,
        environment,
        id,
        label: detail.workflow_label,
        status: detail.status,
        features: detail.features,
        isDesktopAllowed: detail.is_desktop_allowed,
        livenessMethod: config("LIVENESS").face_liveness_method,
        nigeriaServices: config("DATABASE_VALIDATION").database_validation_countries.NGA.services,
      },
      null,
      2,
    ),
  );
}
