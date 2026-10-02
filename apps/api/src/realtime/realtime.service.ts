import { createHash, createHmac, type Hash, type Hmac } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";
import { channelFor, REALTIME_TOKEN_TTL_SECONDS, signRealtimeToken } from "./token";

/**
 * What an open app is told. Only that something changed: it fetches the change
 * from this API, where access is checked, so message text never passes
 * through AppSync.
 */
export type RealtimeEvent = { type: "message"; conversationId: string };

/** What a signed-in member's app needs to open its live connection. */
export type RealtimeConnection =
  | { enabled: false }
  | {
      enabled: true;
      url: string;
      host: string;
      channel: string;
      token: string;
      expiresAt: string;
    };

/** The kinkord/realtime secret, made by infra/lib/realtime-stack.ts. */
interface Settings {
  httpDomain: string;
  wsDomain: string;
  key: string;
}

const DEFAULT_SECRET_ID = "kinkord/realtime";
/** After a failed load (before the stack exists, say), try again this much later. */
const RETRY_AFTER_MS = 5 * 60_000;
/** A publish that hangs shouldn't hold anything up. */
const PUBLISH_TIMEOUT_MS = 3_000;

type SourceData = string | ArrayBuffer | ArrayBufferView;
const bytes = (data: SourceData): Buffer =>
  typeof data === "string"
    ? Buffer.from(data)
    : ArrayBuffer.isView(data)
      ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      : Buffer.from(data);

/** Node's own SHA-256, in the shape the SigV4 signer asks for. */
class Sha256 {
  private readonly hash: Hash | Hmac;
  constructor(secret?: SourceData) {
    this.hash = secret ? createHmac("sha256", bytes(secret)) : createHash("sha256");
  }
  update(data: SourceData): void {
    this.hash.update(bytes(data));
  }
  digest(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(this.hash.digest()));
  }
}

/**
 * Live delivery through AppSync Events. Its settings are read at runtime from
 * a secret, so turning it on needed no change to the API's App Runner config.
 * Until they're readable (locally, in tests, or before the stack is
 * deployed) this does nothing and the apps keep polling.
 */
@Injectable()
export class RealtimeService {
  private readonly log = new Logger(RealtimeService.name);
  // Production reads the secret by default; elsewhere only when told which one,
  // so local runs and tests never reach for AWS.
  private readonly secretId =
    process.env.REALTIME_SECRET_ID ??
    (process.env.NODE_ENV === "production" ? DEFAULT_SECRET_ID : undefined);
  private loaded: { settings: Settings | null; at: number } | null = null;
  private loading: Promise<Settings | null> | null = null;
  private signer: SignatureV4 | null = null;

  async connectionFor(userId: string, now = new Date()): Promise<RealtimeConnection> {
    const channel = channelFor(userId);
    const settings = channel ? await this.settings() : null;
    if (!settings || !channel) return { enabled: false };
    const exp = Math.floor(now.getTime() / 1000) + REALTIME_TOKEN_TTL_SECONDS;
    return {
      enabled: true,
      url: `wss://${settings.wsDomain}/event/realtime`,
      host: settings.httpDomain,
      channel,
      token: signRealtimeToken({ sub: userId, exp }, settings.key),
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /**
   * Tells these members' open apps that something changed. Best effort: an
   * app that misses it catches up on its slow fallback poll, so this never
   * throws and never fails the request that caused it.
   */
  async notify(userIds: string[], event: RealtimeEvent): Promise<void> {
    const settings = await this.settings();
    if (!settings) return;
    const channels = [...new Set(userIds.map(channelFor).filter((c): c is string => c !== null))];
    const results = await Promise.allSettled(
      channels.map((c) => this.publish(settings.httpDomain, c, event)),
    );
    for (const r of results) {
      if (r.status === "rejected") this.log.warn(`realtime publish failed: ${String(r.reason)}`);
    }
  }

  /** Loaded once; a failure is retried after a while rather than on every request. */
  private settings(): Promise<Settings | null> {
    if (!this.secretId) return Promise.resolve(null);
    const loaded = this.loaded;
    if (loaded && (loaded.settings || Date.now() - loaded.at < RETRY_AFTER_MS)) {
      return Promise.resolve(loaded.settings);
    }
    this.loading ??= this.load(this.secretId).finally(() => {
      this.loading = null;
    });
    return this.loading;
  }

  private async load(secretId: string): Promise<Settings | null> {
    let settings: Settings | null = null;
    try {
      const out = await new SecretsManagerClient({}).send(
        new GetSecretValueCommand({ SecretId: secretId }),
      );
      const s = JSON.parse(out.SecretString ?? "{}") as Partial<Settings>;
      if (s.httpDomain && s.wsDomain && s.key) {
        settings = { httpDomain: s.httpDomain, wsDomain: s.wsDomain, key: s.key };
      } else {
        this.log.warn(`live chat is off: ${secretId} is missing a field`);
      }
    } catch (e) {
      this.log.warn(`live chat is off: couldn't read ${secretId} (${String(e)})`);
    }
    this.loaded = { settings, at: Date.now() };
    return settings;
  }

  private async publish(host: string, channel: string, event: RealtimeEvent): Promise<void> {
    const body = JSON.stringify({ channel, events: [JSON.stringify(event)] });
    this.signer ??= new SignatureV4({
      service: "appsync",
      region: process.env.AWS_REGION ?? "eu-west-1",
      credentials: defaultProvider(),
      sha256: Sha256,
    });
    const signed = await this.signer.sign({
      method: "POST",
      protocol: "https:",
      hostname: host,
      path: "/event",
      headers: { host, "content-type": "application/json" },
      body,
    });
    // fetch sets Host from the URL itself, the same value that was signed.
    const headers = Object.fromEntries(
      Object.entries(signed.headers).filter(([name]) => name.toLowerCase() !== "host"),
    );
    const res = await fetch(`https://${host}/event`, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`AppSync answered ${res.status}`);
  }
}
