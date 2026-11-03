import { clientIpFrom } from "../moderation/signup-rules";

/**
 * The address a country check is about: the real connection, never one the
 * app reports. In development, LOCATION_CHECK_DEV_IP stands in for it, so a
 * laptop can try being in another country; production ignores it.
 */
export function checkedIp(headers: Headers | null | undefined): string | null {
  const pretend = process.env.LOCATION_CHECK_DEV_IP;
  if (pretend && process.env.NODE_ENV !== "production") return pretend;
  return clientIpFrom(headers);
}
