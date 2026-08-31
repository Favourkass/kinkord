export interface SendSmsInput {
  /** E.164, e.g. +2348012345678 */
  to: string;
  message: string;
}

export interface SendSmsResult {
  provider: string;
  providerMessageId: string | null;
}

/** Outbound SMS provider port. Adapters: Termii (NG). Twilio slot reserved. */
export interface SmsPort {
  readonly providerName: string;
  send(input: SendSmsInput): Promise<SendSmsResult>;
}
