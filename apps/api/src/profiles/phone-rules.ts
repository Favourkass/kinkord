/**
 * Which phone numbers Kinkord takes: Nigerian mobiles only, for now
 * (2026-10-02). Texts to other countries cost more and arrived less reliably.
 * To open another country, add its mobile pattern here, and its dial code and
 * rule on the web (constants/onboarding.ts PHONE_COUNTRY_CODES and
 * domain/onboarding.ts).
 *
 * A Nigerian mobile is +234, then ten digits starting 70, 71, 80, 81, 90 or 91:
 * 0803…, 0813…, 0703…, 0903…, 0913… with the leading 0 dropped.
 */
const ALLOWED_MOBILE_NUMBERS: readonly RegExp[] = [/^\+234[789][01]\d{8}$/];

export const PHONE_NOT_ALLOWED =
  "Kinkord only takes Nigerian mobile numbers for now, like +2348031234567.";

export function isAllowedPhone(e164: string): boolean {
  return ALLOWED_MOBILE_NUMBERS.some((pattern) => pattern.test(e164));
}
