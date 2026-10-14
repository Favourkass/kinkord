import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { diditWorkflowApiKey, readHidden, refuseEnvFileForLive } from "./didit-workflow-env.mjs";

test("live workflow provisioning ignores the API development credential", () => {
  const env = {
    DIDIT_API_KEY: "development-key",
    DIDIT_LIVE_API_KEY: " dedicated-live-key ",
    DIDIT_SANDBOX_API_KEY: "sandbox-key",
  };
  assert.equal(diditWorkflowApiKey("live", env), "dedicated-live-key");
  assert.equal(diditWorkflowApiKey("sandbox", env), "sandbox-key");
});

test("live refuses to run with an env file loaded", () => {
  assert.throws(() => refuseEnvFileForLive("live", ["--env-file=apps/api/.env"]), /env file/);
  assert.throws(() => refuseEnvFileForLive("live", ["--env-file-if-exists=.env"]), /env file/);
  assert.doesNotThrow(() => refuseEnvFileForLive("live", []));
  assert.doesNotThrow(() => refuseEnvFileForLive("sandbox", ["--env-file=apps/api/.env"]));
});

test("the live key is typed in without being shown", async () => {
  const terminal = () => {
    const raw = [];
    const input = Object.assign(new PassThrough(), {
      isTTY: true,
      setRawMode: (on) => raw.push(on),
    });
    const output = { shown: "", write: (text) => (output.shown += text) };
    return { input, output, raw };
  };

  const { input, output, raw } = terminal();
  const key = readHidden("Key: ", input, output);
  input.write("live-kez\u007fy\r");
  assert.equal(await key, "live-key");
  assert.equal(output.shown, "Key: \n");
  assert.deepEqual(raw, [true, false]);

  const cancelled = terminal();
  const pending = readHidden("Key: ", cancelled.input, cancelled.output);
  cancelled.input.write("abc\u0003");
  await assert.rejects(pending, /Cancelled/);
  assert.deepEqual(cancelled.raw, [true, false]);

  await assert.rejects(readHidden("Key: ", new PassThrough(), output), /terminal/);
});
