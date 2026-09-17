import { Injectable, Logger } from "@nestjs/common";
import { ConsoleSmsAdapter } from "./console.adapter";
import { RobaseSmsAdapter } from "./robase.adapter";
import { SendSmsInput, SendSmsResult } from "./sms.port";

/**
 * Outbound SMS. Robase is the provider (2026-09-15): it does its own
 * per-country routing and multi-provider failover, so the country switch we
 * used to carry — Termii for +234, a hard failure everywhere else — is gone,
 * and international numbers are no longer a dead end at signup.
 *
 * With no key configured, local and CI environments print the message instead,
 * the way Mailpit catches email, so the whole verification flow can be tested
 * without a provider account. Production never takes that path: a deployed API
 * missing its key must fail loudly rather than tell members a code is coming
 * and quietly send nothing.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly robase: RobaseSmsAdapter,
    private readonly console: ConsoleSmsAdapter,
  ) {}

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const to = input.to.trim();
    if (!/^\+\d{8,15}$/.test(to)) {
      throw new Error(`SMS destination must be E.164 (got "${to}")`);
    }
    if (process.env.ROBASE_API_KEY) {
      return this.robase.send({ ...input, to });
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("ROBASE_API_KEY is not configured");
    }
    this.logger.warn("ROBASE_API_KEY unset — printing the message instead of sending it");
    return this.console.send({ ...input, to });
  }
}
