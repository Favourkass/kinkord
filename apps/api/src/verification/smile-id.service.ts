import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { Signature, Utilities, WebApi } from "smile-identity-core";

@Injectable()
export class SmileIdService {
  get configured() {
    return Boolean(process.env.SMILE_ID_PARTNER_ID && process.env.SMILE_ID_API_KEY &&
      process.env.SMILE_ID_CALLBACK_URL && process.env.SMILE_ID_POLICY_URL);
  }

  get partnerId() { return process.env.SMILE_ID_PARTNER_ID ?? ""; }
  get callbackUrl() { return process.env.SMILE_ID_CALLBACK_URL ?? ""; }
  get policyUrl() { return process.env.SMILE_ID_POLICY_URL ?? ""; }
  get environment() { return process.env.SMILE_ID_ENVIRONMENT === "live" ? "live" as const : "sandbox" as const; }

  async webToken(userId: string, jobId: string) {
    if (!this.configured) throw new ServiceUnavailableException("Smile ID is not configured yet.");
    const connection = new WebApi(
      this.partnerId,
      this.callbackUrl,
      process.env.SMILE_ID_API_KEY!,
      this.environment === "live" ? 1 : 0,
    );
    try {
      const result = await connection.get_web_token({
        user_id: userId,
        job_id: jobId,
        product: "biometric_kyc",
        callback_url: this.callbackUrl,
      });
      if (!result?.token) throw new Error("Missing web token");
      return result.token;
    } catch {
      throw new ServiceUnavailableException("Smile ID is temporarily unavailable. Please try again.");
    }
  }

  /** Smile signatures authenticate the timestamp, not the callback body. Re-fetch
   * the signed job-status response so no decision trusts a mutable webhook body. */
  async jobResults(userId: string, jobId: string): Promise<Record<string, unknown>[]> {
    if (!this.configured) throw new ServiceUnavailableException("Smile ID is not configured.");
    try {
      const connection = new Utilities(this.partnerId,
        process.env.SMILE_ID_API_KEY!, this.environment === "live" ? 1 : 0);
      const response = await connection.get_job_status(
        userId, jobId, { return_history: true, return_images: false },
      ) as Record<string, unknown>;
      const entries = [response.result, ...(Array.isArray(response.history) ? response.history : [])]
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
      // The SDK verifies the status signature. Also correlate every result to the
      // exact member/job; history may include unrelated jobs for this user.
      return entries.filter((entry) => {
        const params = entry.PartnerParams as Record<string, unknown> | undefined;
        return params?.user_id === userId && params?.job_id === jobId;
      });
    } catch {
      throw new ServiceUnavailableException("Smile ID status is temporarily unavailable.");
    }
  }

  verifyCallback(payload: Record<string, unknown>) {
    if (!this.configured) throw new ServiceUnavailableException("Smile ID is not configured.");
    const timestamp = payload.timestamp;
    const signature = payload.signature;
    if (typeof timestamp !== "string" || typeof signature !== "string" ||
        !Number.isFinite(Date.parse(timestamp)) ||
        !new Signature(this.partnerId, process.env.SMILE_ID_API_KEY!).confirm_signature(timestamp, signature)) {
      throw new UnauthorizedException("Invalid Smile ID callback signature");
    }
  }
}
