import { Injectable, Logger } from "@nestjs/common";
import { SendSmsInput, SendSmsResult } from "./sms.port";
import { TermiiSmsAdapter } from "./termii.adapter";

/**
 * Country-aware SMS routing. Nigerian numbers go through Termii (local
 * routes: ~₦ single digits/SMS vs $0.39 international). Other corridors get
 * a provider when the business chooses one (Twilio slot reserved) — until
 * then we fail loudly rather than silently burning money.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly termii: TermiiSmsAdapter) {}

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const to = input.to.trim();
    if (!/^\+\d{8,15}$/.test(to)) {
      throw new Error(`SMS destination must be E.164 (got "${to}")`);
    }
    if (to.startsWith("+234")) {
      return this.termii.send({ ...input, to });
    }
    // Non-NG corridor: no provider configured yet (Twilio decision pending).
    this.logger.warn(`no SMS provider configured for destination ${to.slice(0, 4)}…`);
    throw new Error("SMS to this destination is not supported yet");
  }
}
