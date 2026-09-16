import { Injectable, Logger } from "@nestjs/common";
import { SendSmsInput, SendSmsResult, SmsPort } from "./sms.port";

/**
 * Local stand-in for a real SMS provider, mirroring what Mailpit does for
 * email: without it, the phone half of verification cannot be exercised on a
 * machine with no provider account, and a contributor is stuck guessing whether
 * their change works until it reaches an environment that has credentials.
 *
 * The code is printed to the API log, so `pnpm --filter api dev` shows it.
 * `SmsService` only reaches for this outside production — a deployed
 * environment with no key must fail loudly rather than quietly not texting
 * anyone while telling them a code is on its way.
 */
@Injectable()
export class ConsoleSmsAdapter implements SmsPort {
  readonly providerName = "console";
  private readonly logger = new Logger(ConsoleSmsAdapter.name);

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    this.logger.log(`[local sms] to ${input.to}: ${input.message}`);
    return { provider: this.providerName, providerMessageId: `local-${Date.now()}` };
  }
}
