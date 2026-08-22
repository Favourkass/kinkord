import { Injectable, Logger } from "@nestjs/common";
import { SendSmsInput, SendSmsResult, SmsPort } from "./sms.port";

interface TermiiSendResponse {
  message_id?: string;
  code?: string;
  message?: string;
}

/**
 * Termii SMS adapter (https://developers.termii.com).
 * Channel comes from TERMII_CHANNEL: "generic" until the DND route is
 * activated on the workspace, then "dnd" so OTPs reach DND-listed numbers.
 */
@Injectable()
export class TermiiSmsAdapter implements SmsPort {
  readonly providerName = "termii";
  private readonly logger = new Logger(TermiiSmsAdapter.name);

  private get baseUrl() {
    return (process.env.TERMII_BASE_URL ?? "https://v4.api.termii.com").replace(/\/$/, "");
  }

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const apiKey = process.env.TERMII_API_KEY;
    if (!apiKey) throw new Error("TERMII_API_KEY is not configured");

    const res = await fetch(`${this.baseUrl}/api/sms/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to: input.to.replace(/^\+/, ""),
        from: process.env.TERMII_SENDER_ID ?? "KINKORD",
        sms: input.message,
        type: "plain",
        channel: process.env.TERMII_CHANNEL ?? "generic",
      }),
    });

    const body = (await res.json().catch(() => ({}))) as TermiiSendResponse;
    if (!res.ok || !body.message_id) {
      this.logger.error(`termii send failed (${res.status}): ${body.message ?? "unknown"}`);
      throw new Error(`SMS delivery failed via Termii (${res.status})`);
    }
    return { provider: this.providerName, providerMessageId: body.message_id };
  }
}
