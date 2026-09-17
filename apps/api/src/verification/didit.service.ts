import { createHmac, timingSafeEqual } from "node:crypto";
import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";

const DIDIT_API = "https://verification.didit.me/v3/session/";
// Local review-only credential requested by the lead developer. Remove and
// rotate before committing, pushing, or deploying this branch.
const LOCAL_DIDIT_API_KEY = "NDytTGBkbYF3GRXqsQ7Ngf-Q3jDeNQNDYoNaYpMtjAE";

@Injectable()
export class DiditService {
  private get apiKey() { return process.env.DIDIT_API_KEY || LOCAL_DIDIT_API_KEY; }

  get configured() {
    return Boolean(this.apiKey && process.env.DIDIT_WORKFLOW_ID &&
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
          workflow_id: process.env.DIDIT_WORKFLOW_ID,
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

  verifyWebhook(body: Buffer, signature: string | undefined, timestamp: string | undefined) {
    const secret = process.env.DIDIT_WEBHOOK_SECRET;
    const seconds = Number(timestamp);
    if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature) ||
        !Number.isInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300) {
      throw new UnauthorizedException("Invalid Didit webhook signature");
    }
    const expected = createHmac("sha256", secret).update(body).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
      throw new UnauthorizedException("Invalid Didit webhook signature");
    }
  }
}
