import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: class {
    send = send;
  },
  GetSecretValueCommand: class {
    constructor(readonly input: unknown) {}
  },
}));

import {
  parseVerificationSettings,
  settingsFromEnv,
  VERIFICATION_OFF,
  VerificationConfig,
} from "./verification-config";

describe("verification settings", () => {
  it("are off when nothing is set", () => {
    expect(VERIFICATION_OFF.enabled).toBe(false);
    expect(VerificationConfig.fixed(VERIFICATION_OFF).identityAvailable).toBe(false);
  });

  it("read booleans and numbers whether the secret or env wrote them", () => {
    const parsed = parseVerificationSettings({
      enabled: "true",
      profileMatchEnabled: true,
      profileMatchThreshold: "95",
      diditMode: "live",
    });
    expect(parsed).toMatchObject({
      enabled: true,
      profileMatch: { enabled: true, threshold: 95 },
      didit: { mode: "live" },
    });
  });

  it("refuse a match threshold below 90 and any mode but live or sandbox", () => {
    const parsed = parseVerificationSettings({ profileMatchThreshold: 50, diditMode: "test" });
    expect(parsed.profileMatch.threshold).toBe(90);
    expect(parsed.didit.mode).toBe("sandbox");
  });

  it("come from env locally, sandbox unless told otherwise", () => {
    const parsed = settingsFromEnv({
      VERIFICATION_ENABLED: "true",
      DIDIT_API_KEY: "k",
      VERIFICATION_BINDING_SECRET: "s",
    } as NodeJS.ProcessEnv);
    expect(parsed).toMatchObject({
      enabled: true,
      didit: { apiKey: "k", mode: "sandbox" },
      bindingSecret: "s",
    });
  });
});

const complete = {
  enabled: true,
  policyUrl: "https://kinkord.com/privacy/verification",
  returnUrl: "https://kinkord.com/settings/verification",
  diditApiKey: "key",
  diditWebhookSecret: "hook",
  diditWorkflowId: "wf",
  diditMode: "live",
  bindingSecret: "b".repeat(64),
};

describe("VerificationConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    send.mockReset();
  });

  it("offers verification only when every piece is set, and only live checks in production", () => {
    const settings = parseVerificationSettings(complete);
    expect(VerificationConfig.fixed(settings, true).identityAvailable).toBe(true);
    const sandbox = parseVerificationSettings({ ...complete, diditMode: "sandbox" });
    expect(VerificationConfig.fixed(sandbox, true).identityAvailable).toBe(false);
    expect(VerificationConfig.fixed(sandbox, false).identityAvailable).toBe(true);
    const shortKey = parseVerificationSettings({ ...complete, bindingSecret: "short" });
    expect(VerificationConfig.fixed(shortKey, true).identityAvailable).toBe(false);
  });

  it("reads the secret, keeps the last good settings, and logs a failure once", async () => {
    vi.stubEnv("VERIFICATION_SECRET_ID", "kinkord/verification");
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const config = new VerificationConfig();
    expect(config.identityAvailable).toBe(false);

    send.mockResolvedValueOnce({ SecretString: JSON.stringify(complete) });
    await config.refresh();
    expect(config.identityAvailable).toBe(true);

    const missing = Object.assign(new Error("gone"), { name: "ResourceNotFoundException" });
    send.mockRejectedValue(missing);
    await config.refresh();
    await config.refresh();
    expect(config.identityAvailable).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
