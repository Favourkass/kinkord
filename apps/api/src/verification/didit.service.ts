import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { downloadVerificationImage, type VerificationImage } from "../storage/verification-image";
import { profileMatchDecision } from "./profile-match-policy";

const DIDIT_API = "https://verification.didit.me/v3/session/";

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort()
      .map((key) => [key, sortJson((value as Record<string, unknown>)[key])]));
  }
  return value;
}

function validHexSignature(signature: string | undefined, expected: Buffer) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

@Injectable()
export class DiditService {
  get mode() { return process.env.DIDIT_MODE?.trim() || "live"; }

  get profileMatchThreshold() {
    return Number(process.env.DIDIT_PROFILE_FACE_MATCH_THRESHOLD ?? "90");
  }

  get profileMatchEnabled() {
    const threshold = this.profileMatchThreshold;
    return this.configured && process.env.DIDIT_PROFILE_FACE_MATCH_ENABLED === "true" &&
      Number.isFinite(threshold) && threshold >= 90 && threshold <= 100;
  }

  async compareProfilePhoto(selfieUrl: string, profile: VerificationImage, attemptId: string) {
    if (!this.profileMatchEnabled) throw new ServiceUnavailableException("Profile comparison is disabled.");
    const selfie = await downloadVerificationImage(selfieUrl);
    const form = new FormData();
    form.append("user_image", new Blob([new Uint8Array(selfie.bytes)], { type: selfie.contentType }), `selfie.${selfie.extension}`);
    form.append("ref_image", new Blob([new Uint8Array(profile.bytes)], { type: profile.contentType }), `profile.${profile.extension}`);
    form.append("face_match_score_decline_threshold", String(this.profileMatchThreshold));
    form.append("save_api_request", "false");
    form.append("vendor_data", attemptId);
    const response = await fetch("https://verification.didit.me/v3/face-match/", {
      method: "POST", headers: { "x-api-key": this.apiKey }, body: form,
      redirect: "error", signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new ServiceUnavailableException("Profile comparison unavailable.");
    return profileMatchDecision(await response.json(), this.profileMatchThreshold, this.mode);
  }

  private get apiKey() {
    if (this.mode === "sandbox") return process.env.DIDIT_SANDBOX_API_KEY?.trim() ?? "";
    if (this.mode === "live") return process.env.DIDIT_API_KEY?.trim() ?? "";
    return "";
  }

  get workflowId() {
    if (this.mode === "sandbox") return process.env.DIDIT_SANDBOX_WORKFLOW_ID?.trim() ?? "";
    if (this.mode === "live") return process.env.DIDIT_LIVE_WORKFLOW_ID?.trim() ?? "";
    return "";
  }

  get configured() {
    return Boolean(this.apiKey && this.workflowId &&
      process.env.DIDIT_RETURN_URL && process.env.BRONZE_POLICY_URL);
  }

  get policyUrl() { return process.env.BRONZE_POLICY_URL ?? ""; }

  async createSession(userId: string) {
    if (!this.configured) throw new ServiceUnavailableException("Didit is not configured yet.");
    try {
      const response = await fetch(DIDIT_API, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey },
        body: JSON.stringify({
          workflow_id: this.workflowId,
          callback: process.env.DIDIT_RETURN_URL,
          vendor_data: userId,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Didit session request failed: ${response.status}`);
      const session = await response.json() as Record<string, unknown>;
      if (typeof session.session_id !== "string" || typeof session.url !== "string" ||
          !/^https:\/\/verify\.didit\.me\//.test(session.url) || session.vendor_data !== userId) {
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
      return await response.json() as Record<string, unknown>;
    } catch {
      throw new ServiceUnavailableException("Didit status is temporarily unavailable.");
    }
  }

  verifyWebhook(body: Buffer, signatureV2: string | undefined,
    signatureRaw: string | undefined, timestamp: string | undefined) {
    const secret = process.env.DIDIT_WEBHOOK_SECRET;
    const seconds = Number(timestamp);
    if (!secret || !Number.isInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
      throw new UnauthorizedException("Invalid Didit webhook signature");
    }
    let canonical: Buffer | null = null;
    try {
      canonical = Buffer.from(JSON.stringify(sortJson(JSON.parse(body.toString("utf8")))), "utf8");
    } catch {
      // The callback handler will report malformed JSON after authentication.
    }
    const v2Matches = canonical && validHexSignature(signatureV2,
      createHmac("sha256", secret).update(canonical).digest());
    const rawMatches = validHexSignature(signatureRaw,
      createHmac("sha256", secret).update(body).digest());
    if (!v2Matches && !rawMatches) {
      throw new UnauthorizedException("Invalid Didit webhook signature");
    }
  }
}
