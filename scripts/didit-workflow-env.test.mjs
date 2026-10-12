import assert from "node:assert/strict";
import test from "node:test";
import { diditWorkflowApiKey } from "./didit-workflow-env.mjs";

test("live workflow provisioning ignores the API development credential", () => {
  const env = {
    DIDIT_API_KEY: "development-key",
    DIDIT_LIVE_API_KEY: " dedicated-live-key ",
    DIDIT_SANDBOX_API_KEY: "sandbox-key",
  };
  assert.equal(diditWorkflowApiKey("live", env), "dedicated-live-key");
  assert.equal(diditWorkflowApiKey("sandbox", env), "sandbox-key");
});
