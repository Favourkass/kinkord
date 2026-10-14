/**
 * Free members start chats with members in their own country; starting one
 * with a member in another country is part of Silver Premium. Replies are
 * always free: once the other member has written in a thread, either of them
 * may write. The super admins are exempt, as from the daily allowance. Follows
 * and the feed stay open across countries.
 */

/**
 * The country of a member with none saved: Nigeria, Kinkord's only country
 * before Kenya. The web app's DEFAULT_SIGNUP_COUNTRY says the same.
 */
export const DEFAULT_COUNTRY = "NG";

/** The error code the web app reads to offer Silver. */
export const CROSS_COUNTRY_PREMIUM = "CROSS_COUNTRY_PREMIUM";

export const CROSS_COUNTRY_MESSAGE =
  "Messaging members in another country is part of Silver Premium.";

/** Whether two members' saved countries (ISO alpha-2, or none) are different countries. */
export function differentCountries(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return (a ?? DEFAULT_COUNTRY) !== (b ?? DEFAULT_COUNTRY);
}
