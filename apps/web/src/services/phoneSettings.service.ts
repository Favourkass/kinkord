import { isAllowedPhone, PHONE_NIGERIA_ONLY, toE164 } from "@/domain/onboarding";
import { profileApi } from "./profile.service";

/** Optional phone collection after signup uses the same rules as verification. */
export function saveSettingsPhone(value: string) {
  const phone = toE164("+234", value);
  if (!isAllowedPhone(phone)) throw new Error(PHONE_NIGERIA_ONLY);
  return profileApi.update({ phone });
}
