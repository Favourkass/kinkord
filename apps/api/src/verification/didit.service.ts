import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { downloadVerificationImage, type VerificationImage } from "../storage/verification-image";
import { profileMatchDecision } from "./profile-match-policy";
import { VerificationConfig } from "./verification-config";

const DIDIT_API = "https://verification.didit.me/v3/session/";
/** Didit's decision payloads are small; anything larger isn't a real callback. */
export const DIDIT_WEBHOOK_MAX_BYTES = 512 * 1024;

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, sortJson((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}

function validHexSignature(signature: string | undefined, expected: Buffer) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

@Injectable()
export class DiditService {
  constructor(private readonly config: VerificationConfig) {}

  get mode() {
    return this.config.current.didit.mode;
  }

  /** Identity verification can be offered right now. */
  get configured() {
    return this.config.identityAvailable;
  }

  get profileMatchEnabled() {
    return this.config.profileMatchAvailable;
  }

  get profileMatchThreshold() {
    return this.config.current.profileMatch.threshold;
  }

  get workflowId() {
    return this.config.current.didit.workflowId;
  }

  get policyUrl() {
    return this.config.current.policyUrl;
  }

  private get apiKey() {
    return this.config.current.didit.apiKey;
  }

  async compareProfilePhoto(selfieUrl: string, profile: VerificationImage, attemptId: string) {
    if (!this.profileMatchEnabled)
      throw new ServiceUnavailableException("Profile comparison is disabled.");
    const selfie = await downloadVerificationImage(selfieUrl);
    const form = new FormData();
    form.append(
      "user_image",
      new Blob([new Uint8Array(selfie.bytes)], { type: selfie.contentType }),
      `selfie.${selfie.extension}`,
    );
    form.append(
      "ref_image",
      new Blob([new Uint8Array(profile.bytes)], { type: profile.contentType }),
      `profile.${profile.extension}`,
    );
    form.append("face_match_score_decline_threshold", String(this.profileMatchThreshold));
    form.append("save_api_request", "false");
    form.append("vendor_data", attemptId);
    const response = await fetch("https://verification.didit.me/v3/face-match/", {
      method: "POST",
      headers: { "x-api-key": this.apiKey },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new ServiceUnavailableException("Profile comparison unavailable.");
    return profileMatchDecision(await response.json(), this.profileMatchThreshold, this.mode);
  }

  async createSession(userId: string) {
    if (!this.configured) throw new ServiceUnavailableException("Didit is not configured yet.");
    try {
      const response = await fetch(DIDIT_API, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify({
          workflow_id: this.workflowId,
          callback: this.config.current.returnUrl,
          vendor_data: userId,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Didit session request failed: ${response.status}`);
      const session = (await response.json()) as Record<string, unknown>;
      if (
        typeof session.session_id !== "string" ||
        typeof session.url !== "string" ||
        !/^https:\/\/verify\.didit\.me\//.test(session.url) ||
        session.vendor_data !== userId
      ) {
        throw new Error("Invalid Didit session response");
      }
      return { sessionId: session.session_id, url: session.url };
    } catch {
      throw new ServiceUnavailableException("Didit is temporarily unavailable. Please try again.");
    }
  }

  async decision(sessionId: string): Promise<Record<string, unknown>> {
    if (!this.configured) throw new ServiceUnavailableException("Didit is not configured.");
    try {
      const response = await fetch(`${DIDIT_API}${encodeURIComponent(sessionId)}/decision/`, {
        headers: { "x-api-key": this.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Didit decision request failed: ${response.status}`);
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("Didit status is temporarily unavailable.");
    }
  }

  /**
   * Erases a session at Didit with its decision, documents, media and face
   * templates. Used when a member withdraws consent or their account is deleted.
   * A session that's already gone counts as deleted.
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.apiKey) throw new ServiceUnavailableException("Didit is not configured.");
    const response = await fetch(`${DIDIT_API}${encodeURIComponent(sessionId)}/delete/`, {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({
        retain_face_embeddings: false,
        deletion_instruction: "privacy_erasure",
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok && response.status !== 404) {
      throw new ServiceUnavailableException(`Didit deletion failed (${response.status}).`);
    }
  }

  /** Checks a callback before anything in it is trusted; the body must be the raw bytes. */
  verifyWebhook(
    body: unknown,
    signatureV2: string | undefined,
    signatureRaw: string | undefined,
    timestamp: string | undefined,
  ): Buffer {
    if (!Buffer.isBuffer(body) || body.length === 0 || body.length > DIDIT_WEBHOOK_MAX_BYTES) {
      throw new BadRequestException("Invalid Didit callback");
    }
    const secret = this.config.current.didit.webhookSecret;
    const seconds = Number(timestamp);
    if (!secret || !Number.isInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
      throw new UnauthorizedException("Invalid Didit webhook signature");
    }
    // The raw-body signature needs no parsing, so check it first.
    if (validHexSignature(signatureRaw, createHmac("sha256", secret).update(body).digest())) {
      return body;
    }
    let canonical: Buffer | null = null;
    try {
      canonical = Buffer.from(JSON.stringify(sortJson(JSON.parse(body.toString("utf8")))), "utf8");
    } catch {
      // Unparseable bodies can't carry a valid canonical signature.
    }
    if (
      canonical &&
      validHexSignature(signatureV2, createHmac("sha256", secret).update(canonical).digest())
    ) {
      return body;
    }
    throw new UnauthorizedException("Invalid Didit webhook signature");
  }
}
