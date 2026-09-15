import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { SendSmsInput, SendSmsResult, SmsPort } from "./sms.port";

interface RobaseSendResponse {
  id?: string;
  status?: string;
  message?: string;
  error?: string;
}

/**
 * Robase transactional SMS (https://api.robase.dev). Replaced Termii on
 * 2026-09-15 after Termii rejected every send with SENDER_ID_NOT_APPROVED.
 *
 * Deliberately plain `fetch` rather than the `@robasedev/sdk` package: the
 * request is four fields, and the package is young enough that taking it into
 * the signup path is a supply-chain risk we do not need.
 *
 * Robase runs its own OTP endpoints too (`/v1/otp/*`), but we send codes as
 * ordinary messages so verification stays ours — hashed storage, per-member
 * rate limits, the three-strike lockout — rather than living in a third party.
 */
@Injectable()
export class RobaseSmsAdapter implements SmsPort {
  readonly providerName = "robase";
  private readonly logger = new Logger(RobaseSmsAdapter.name);

  private get baseUrl() {
    return (process.env.ROBASE_BASE_URL ?? "https://api.robase.dev").replace(/\/$/, "");
  }

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const apiKey = process.env.ROBASE_API_KEY;
    if (!apiKey) throw new Error("ROBASE_API_KEY is not configured");

    const res = await fetch(`${this.baseUrl}/v1/sms/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        // A retried send must not become a second message to the member.
        "idempotency-key": randomUUID(),
      },
      body: JSON.stringify({ phone_number: input.to, message: input.message }),
    });

    const body = (await res.json().catch(() => ({}))) as RobaseSendResponse;
    if (!res.ok || !body.id) {
      // The provider's own words are what make this diagnosable at 2am.
      this.logger.error(
        `robase send failed (${res.status}): ${body.error ?? body.message ?? "unknown"}`,
      );
      throw new Error(`SMS delivery failed via Robase (${res.status})`);
    }
    return { provider: this.providerName, providerMessageId: body.id };
  }
}
