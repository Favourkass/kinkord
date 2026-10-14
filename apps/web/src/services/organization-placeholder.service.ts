/**
 * Temporary organization classification for the official Kinkord account.
 *
 * The immutable user id is deliberately supplied by deployment configuration,
 * rather than encoding a production identity in source or trusting a mutable
 * username/display name. An absent value disables the placeholder everywhere.
 */
export function isOfficialOrganization(
  userId: string | null | undefined,
  configuredUserId = process.env.NEXT_PUBLIC_KINKORD_OFFICIAL_USER_ID,
): boolean {
  const officialUserId = configuredUserId?.trim();
  return Boolean(userId && officialUserId && userId === officialUserId);
}
