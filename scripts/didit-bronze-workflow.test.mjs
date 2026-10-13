import assert from "node:assert/strict";
import test from "node:test";
import { bronzeWorkflowPayload, workflowDifferences } from "./didit-bronze-workflow.mjs";

test("the Bronze workflow keeps Kinkord's verification rules", () => {
  for (const environment of ["sandbox", "live"]) {
    const { features } = bronzeWorkflowPayload(environment);
    const config = (name) => features.find((item) => item.feature === name)?.config;
    // Didit only warns; Kinkord's own admin review decides possible duplicates.
    assert.equal(config("OCR").duplicated_user_action, "NO_ACTION");
    assert.equal(config("OCR").is_age_restrictions_enabled, true);
    assert.equal(config("OCR").minimum_age, 18);
    assert.equal(config("OCR").minimum_age_action, "DECLINE");
    assert.equal(config("LIVENESS").face_liveness_method, "ACTIVE_3D");
    assert.ok(features.some((item) => item.feature === "FACE_MATCH"));
    const registry = config("DATABASE_VALIDATION");
    assert.deepEqual(registry.database_validation_countries.NGA.services, ["nga_national_id"]);
    assert.equal(registry.database_validation_partial_match_action, "REVIEW");
    assert.equal(registry.database_validation_no_match_action, "DECLINE");
  }
});

/** A workflow as Didit returns it: each feature a node in its graph. */
const asDidit = (payload) => ({
  workflow_graph: {
    nodes: Object.fromEntries(
      payload.features.map(({ feature, config }, index) => [
        `node-${index}`,
        { node_type: "feature", feature, config },
      ]),
    ),
  },
});

test("an existing workflow is reused only while it matches", () => {
  const payload = bronzeWorkflowPayload("live");
  const same = structuredClone(payload);
  // Settings Didit adds beyond ours don't count.
  same.features[1].config.extra_setting = true;
  assert.deepEqual(workflowDifferences(payload, asDidit(same)), []);

  const drifted = structuredClone(payload);
  drifted.features[0].config.duplicated_user_action = "REVIEW";
  drifted.features[3].config.database_validation_countries.NGA.services = [];
  drifted.features.splice(1, 1);
  assert.deepEqual(workflowDifferences(payload, asDidit(drifted)), [
    'OCR.duplicated_user_action is "REVIEW", not "NO_ACTION"',
    "LIVENESS is missing",
    'DATABASE_VALIDATION.database_validation_countries.NGA.services is [], not ["nga_national_id"]',
  ]);
});
