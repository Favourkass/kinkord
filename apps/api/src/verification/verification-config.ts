import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

/** Production's settings live here, made by infra/lib/verification-stack.ts. */
export const DEFAULT_VERIFICATION_SECRET_ID = "kinkord/verification";
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
  /** The last read's failure, so a missing secret is logged once rather than every refresh. */
  private problem: string | null = null;
  readonly production: boolean;
  private readonly secretId: string | null;

  constructor() {
    this.production = process.env.NODE_ENV === "production";
    this.secretId =
      process.env.VERIFICATION_SECRET_ID?.trim() ||
      (this.production ? DEFAULT_VERIFICATION_SECRET_ID : null);
    this.settings = this.secretId ? VERIFICATION_OFF : settingsFromEnv();
  }

  /** A fixed configuration, for tests. */
  static fixed(settings: VerificationSettings, production = false): VerificationConfig {
    const config = Object.create(VerificationConfig.prototype) as VerificationConfig;
    Object.assign(config, {
      log: new Logger(VerificationConfig.name),
      settings,
      timer: null,
      problem: null,
      production,
      secretId: null,
    });
    return config;
  }

  onModuleInit() {
    if (!this.secretId) return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), REFRESH_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Re-reads the secret; public so tests can await one read. */
  async refresh() {
    if (!this.secretId) return;
    try {
      const out = await new SecretsManagerClient({}).send(
        new GetSecretValueCommand({ SecretId: this.secretId }),
      );
      this.settings = parseVerificationSettings(
        JSON.parse(out.SecretString ?? "{}") as Record<string, unknown>,
      );
      this.problem = null;
    } catch (e) {
      // Keep the last good settings; a first failure leaves verification off.
      const problem = e instanceof Error ? e.name : "error";
      if (problem !== this.problem)
        this.log.warn(
          `verification settings unavailable (${problem}); verification stays as it was`,
        );
      this.problem = problem;
    }
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

  get profileMatchAvailable(): boolean {
    return this.identityAvailable && this.settings.profileMatch.enabled;
  }
}
