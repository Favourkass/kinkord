import { Injectable } from "@nestjs/common";
import { RobaseSmsAdapter } from "./robase.adapter";
import { SendSmsInput, SendSmsResult } from "./sms.port";

/**
 * Outbound SMS. Robase is the single provider (2026-09-15): it does its own
 * per-country routing and multi-provider failover, so the country switch we
 * used to carry — Termii for +234, a hard failure for everywhere else — is
 * gone, and international numbers are no longer a dead end at signup.
 */
@Injectable()
export class SmsService {
  constructor(private readonly robase: RobaseSmsAdapter) {}

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const to = input.to.trim();
    if (!/^\+\d{8,15}$/.test(to)) {
      throw new Error(`SMS destination must be E.164 (got "${to}")`);
    }
    return this.robase.send({ ...input, to });
  }
}
