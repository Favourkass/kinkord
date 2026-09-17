export interface SendSmsInput {
  /** E.164, e.g. +2348012345678 */
  to: string;
  message: string;
}

export interface SendSmsResult {
  provider: string;
  providerMessageId: string | null;
}

/** Outbound SMS provider port. Adapter: Robase (own per-country routing). */
export interface SmsPort {
  readonly providerName: string;
  send(input: SendSmsInput): Promise<SendSmsResult>;
}
