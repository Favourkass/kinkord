import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  describe("in production", () => {
    const SETTINGS = "kinkord/verification";
    const BINDING = "kinkord/verification-binding";
    const key = { bindingSecret: "b".repeat(64) };
    const missing = Object.assign(new Error("gone"), { name: "ResourceNotFoundException" });
    /** Answers each secret by id; an Error makes that read fail. */
    const secrets = (values: Record<string, unknown>) =>
      send.mockImplementation(async ({ input }: { input: { SecretId: string } }) => {
        const value = values[input.SecretId];
        if (value instanceof Error) throw value;
        return { SecretString: JSON.stringify(value) };
      });
    const loaded = async () => {
      vi.stubEnv("VERIFICATION_SECRET_ID", SETTINGS);
      vi.stubEnv("VERIFICATION_BINDING_SECRET_ID", BINDING);
      const config = new VerificationConfig();
      expect(config.identityAvailable).toBe(false);
      secrets({ [SETTINGS]: complete, [BINDING]: key });
      await config.refresh();
      expect(config.identityAvailable).toBe(true);
      return config;
    };
    let warn: ReturnType<typeof vi.spyOn>;
    let info: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      info = vi.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    });
    afterEach(() => {
      warn.mockRestore();
      info.mockRestore();
    });

    it("reads the key only from its own secret", async () => {
      vi.stubEnv("VERIFICATION_SECRET_ID", SETTINGS);
      vi.stubEnv("VERIFICATION_BINDING_SECRET_ID", BINDING);
      const config = new VerificationConfig();
      secrets({
        [SETTINGS]: { ...complete, bindingSecret: "legacy-settings-copy" },
        [BINDING]: key,
      });
      await config.refresh();
      expect(config.identityAvailable).toBe(true);
      expect(config.current.bindingSecret).toBe(key.bindingSecret);
      expect(send.mock.calls.map(([command]) => command.input)).toEqual([
        { SecretId: SETTINGS },
        { SecretId: BINDING },
      ]);
    });

    it("switches off even while the key can't be read, and logs that once", async () => {
      const config = await loaded();
      secrets({ [SETTINGS]: { ...complete, enabled: false }, [BINDING]: missing });
      await config.refresh();
      await config.refresh();
      expect(config.current.enabled).toBe(false);
      expect(config.current.bindingSecret).toBe("");
      expect(config.identityAvailable).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain(
        `verification settings unavailable (ResourceNotFoundException reading ${BINDING})`,
      );
    });

    it("stays off without the key even when the settings say on", async () => {
      const config = await loaded();
      secrets({ [SETTINGS]: complete, [BINDING]: missing });
      await config.refresh();
      expect(config.current.enabled).toBe(true);
      expect(config.identityAvailable).toBe(false);
    });

    it("keeps the last good settings when they can't be read, and logs each failure once", async () => {
      const config = await loaded();
      secrets({ [SETTINGS]: missing, [BINDING]: key });
      await config.refresh();
      await config.refresh();
      expect(config.identityAvailable).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain(`ResourceNotFoundException reading ${SETTINGS})`);

      secrets({ [SETTINGS]: missing, [BINDING]: missing });
      await config.refresh();
      expect(config.current.enabled).toBe(true);
      expect(config.identityAvailable).toBe(false);
      expect(warn).toHaveBeenCalledTimes(2);

      secrets({ [SETTINGS]: complete, [BINDING]: key });
      await config.refresh();
      expect(config.identityAvailable).toBe(true);
      expect(info.mock.calls.map(([message]) => message)).toEqual([
        `verification settings read from ${SETTINGS} again`,
        `verification settings read from ${BINDING} again`,
      ]);
    });

    it("treats a secret that isn't a JSON object as unreadable", async () => {
      const config = await loaded();
      send.mockImplementation(async ({ input }: { input: { SecretId: string } }) => ({
        SecretString: input.SecretId === SETTINGS ? "not json" : "null",
      }));
      await config.refresh();
      expect(config.current.enabled).toBe(true);
      expect(config.identityAvailable).toBe(false);
      expect(warn.mock.calls.map(([message]) => message)).toEqual([
        expect.stringContaining(`SyntaxError reading ${SETTINGS}`),
        expect.stringContaining(`TypeError reading ${BINDING}`),
      ]);
    });
  });

  it("offers verification only to listed testers while any are set", () => {
    const on = {
      enabled: true,
      policyUrl: "https://kinkord.test/privacy/verification",
      returnUrl: "https://kinkord.test/settings/verification",
      diditApiKey: "k",
      diditWebhookSecret: "w",
      diditWorkflowId: "wf",
      bindingSecret: "b".repeat(40),
    };
    const testing = VerificationConfig.fixed(
      parseVerificationSettings({ ...on, testers: " staff-1, staff-2 ,," }),
    );
    expect(testing.current.testers).toEqual(["staff-1", "staff-2"]);
    expect(testing.availableTo("staff-2")).toBe(true);
    expect(testing.availableTo("member-1")).toBe(false);
    const open = VerificationConfig.fixed(parseVerificationSettings(on));
    expect(open.availableTo("member-1")).toBe(true);
    const off = VerificationConfig.fixed(parseVerificationSettings({ ...on, enabled: false }));
    expect(off.availableTo("staff-1")).toBe(false);
  });
});
