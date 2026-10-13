import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/** Production's settings live here, made by infra/lib/verification-stack.ts. */
export const DEFAULT_VERIFICATION_SECRET_ID = "kinkord/verification";
/** Kept separate and retained because rotation would invalidate every stored identity fingerprint. */
export const DEFAULT_VERIFICATION_BINDING_SECRET_ID = "kinkord/verification-binding";
/** How often production re-reads the secret, so a switch flipped in the console lands without a deploy. */
const REFRESH_MS = 5 * 60_000;

export type ProviderMode = "sandbox" | "live";

/** Everything identity verification needs. Off unless every piece is present. */
export interface VerificationSettings {
  /** The master switch, set once the privacy notice is legally approved. */
  enabled: boolean;
  /** The approved privacy notice members agree to. */
  policyUrl: string;
  /** Where Didit sends a member back to when they finish. */
  returnUrl: string;
  didit: { apiKey: string; webhookSecret: string; workflowId: string; mode: ProviderMode };
  profileMatch: { enabled: boolean; threshold: number };
  /** Keys the one-way identity fingerprint; changing it breaks every stored fingerprint. */
  bindingSecret: string;
  /**
   * Staff-only testing: while any user ids are listed, verification is offered
   * to those members alone. Empty means everyone.
   */
  testers: string[];
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const flag = (value: unknown) => value === true || text(value).toLowerCase() === "true";
const number = (value: unknown, fallback: number, min: number, max: number) => {
  const n = typeof value === "number" ? value : Number(text(value) || NaN);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/** Reads the flat key/value shape the secret holds; anything missing or malformed is off. */
export function parseVerificationSettings(raw: Record<string, unknown>): VerificationSettings {
  return {
    enabled: flag(raw.enabled),
    policyUrl: text(raw.policyUrl),
    returnUrl: text(raw.returnUrl),
    didit: {
      apiKey: text(raw.diditApiKey),
      webhookSecret: text(raw.diditWebhookSecret),
      workflowId: text(raw.diditWorkflowId),
      mode: text(raw.diditMode) === "live" ? "live" : "sandbox",
    },
    profileMatch: {
      enabled: flag(raw.profileMatchEnabled),
      threshold: number(raw.profileMatchThreshold, 90, 90, 100),
    },
    bindingSecret: text(raw.bindingSecret),
    testers: text(raw.testers)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
}

/** Local development reads the same settings from environment variables. */
export function settingsFromEnv(env: NodeJS.ProcessEnv = process.env): VerificationSettings {
  return parseVerificationSettings({
    enabled: env.VERIFICATION_ENABLED,
    policyUrl: env.VERIFICATION_POLICY_URL,
    returnUrl: env.VERIFICATION_RETURN_URL,
    diditApiKey: env.DIDIT_API_KEY,
    diditWebhookSecret: env.DIDIT_WEBHOOK_SECRET,
    diditWorkflowId: env.DIDIT_WORKFLOW_ID,
    diditMode: env.DIDIT_MODE,
    profileMatchEnabled: env.DIDIT_PROFILE_FACE_MATCH_ENABLED,
    profileMatchThreshold: env.DIDIT_PROFILE_FACE_MATCH_THRESHOLD,
    bindingSecret: env.VERIFICATION_BINDING_SECRET,
    testers: env.VERIFICATION_TESTERS,
  });
}

export const VERIFICATION_OFF: VerificationSettings = parseVerificationSettings({});

/**
 * Identity verification's settings and what they allow. Production reads them
 * at runtime from a secret, so turning verification on needs no change to the
 * API's App Runner config (whose stack must not be redeployed); locally they
 * come from env. Until they load, everything is off.
 */
@Injectable()
export class VerificationConfig implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(VerificationConfig.name);
  private settings: VerificationSettings;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Each secret's last read failure, so one that's missing is logged once, not every refresh. */
  private problems: Record<"settings" | "binding", string | null> = {
    settings: null,
    binding: null,
  };
  readonly production: boolean;
  private readonly settingsSecretId: string | null;
  private readonly bindingSecretId: string | null;

  constructor() {
    this.production = process.env.NODE_ENV === "production";
    this.settingsSecretId =
      process.env.VERIFICATION_SECRET_ID?.trim() ||
      (this.production ? DEFAULT_VERIFICATION_SECRET_ID : null);
    this.bindingSecretId =
      process.env.VERIFICATION_BINDING_SECRET_ID?.trim() ||
      (this.production ? DEFAULT_VERIFICATION_BINDING_SECRET_ID : null);
    this.settings = this.settingsSecretId ? VERIFICATION_OFF : settingsFromEnv();
  }

  /** A fixed configuration, for tests. */
  static fixed(settings: VerificationSettings, production = false): VerificationConfig {
    const config = Object.create(VerificationConfig.prototype) as VerificationConfig;
    Object.assign(config, {
      log: new Logger(VerificationConfig.name),
      settings,
      timer: null,
      problems: { settings: null, binding: null },
      production,
      settingsSecretId: null,
      bindingSecretId: null,
    });
    return config;
  }

  onModuleInit() {
    if (!this.settingsSecretId || !this.bindingSecretId) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Re-reads both secrets, each on its own. Readable settings always apply, so
   * the off switch works even while the key can't be read; unreadable ones
   * keep the last good settings (a first failure leaves verification off). An
   * unreadable key is blanked, which keeps identity verification off until it
   * can be read. Public so tests can await one read.
   */
  async refresh() {
    const settingsId = this.settingsSecretId;
    const bindingId = this.bindingSecretId;
    if (!settingsId || !bindingId) return;
    const [settings, binding] = await Promise.allSettled([
      this.read(settingsId).then(parseVerificationSettings),
      this.read(bindingId).then((raw) => text(raw.bindingSecret)),
    ]);
    this.settings = {
      ...(settings.status === "fulfilled" ? settings.value : this.settings),
      bindingSecret: binding.status === "fulfilled" ? binding.value : "",
    };
    this.report("settings", settingsId, settings, "verification stays as it was");
    this.report("binding", bindingId, binding, "verification is off until it can be read");
  }

  private async read(secretId: string) {
    const client = new SecretsManagerClient({});
    const out = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    return JSON.parse(out.SecretString ?? "{}") as Record<string, unknown>;
  }

  /** Logs a secret's failure once rather than every refresh, and when it's readable again. */
  private report(
    which: "settings" | "binding",
    secretId: string,
    result: PromiseSettledResult<unknown>,
    consequence: string,
  ) {
    const problem =
      result.status === "fulfilled"
        ? null
        : result.reason instanceof Error
          ? result.reason.name
          : "error";
    if (problem && problem !== this.problems[which])
      this.log.warn(
        `verification settings unavailable (${problem} reading ${secretId}); ${consequence}`,
      );
    else if (!problem && this.problems[which])
      this.log.log(`verification settings read from ${secretId} again`);
    this.problems[which] = problem;
  }

  get current(): VerificationSettings {
    return this.settings;
  }

  /** Identity verification can be offered: switched on, notice approved, Didit fully set up. */
  get identityAvailable(): boolean {
    const s = this.settings;
    return (
      s.enabled &&
      Boolean(s.policyUrl && s.returnUrl) &&
      Boolean(s.didit.apiKey && s.didit.webhookSecret && s.didit.workflowId) &&
      s.bindingSecret.length >= 32 &&
      // Sandbox checks never verify a real member.
      (!this.production || s.didit.mode === "live")
    );
  }

  /** Whether this member may verify now: available, and a listed tester while testing. */
  availableTo(userId: string): boolean {
    const { testers } = this.settings;
    return this.identityAvailable && (testers.length === 0 || testers.includes(userId));
  }

  get profileMatchAvailable(): boolean {
    return this.identityAvailable && this.settings.profileMatch.enabled;
  }
}
