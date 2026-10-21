/**
 * The setup key inside an authenticator link: what a member types or pastes
 * into their app ("Enter a setup key") when they can't scan the QR code, as
 * when they're setting up on the same phone that shows it. Null when the link
 * carries none.
 */
export function setupKeyOf(totpURI: string): string | null {
  try {
    const secret = new URL(totpURI).searchParams.get("secret");
    return secret ? secret.replace(/\s+/g, "").toUpperCase() : null;
  } catch {
    return null;
  }
}

/** "JBSWY3DPEHPK3PXP" → "JBSW Y3DP EHPK 3PXP": easier to read and to type. Apps ignore the spaces. */
export function groupedKey(key: string): string {
  return key.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Backup codes as one block of text to paste somewhere safe, one per line. */
export function backupCodesText(codes: string[]): string {
  return codes.join("\n");
}
