import { PRIVACY_AUDIENCES, PRIVACY_FIELDS } from "@/constants/privacy";
import type { PrivacyAudience, PrivacyField } from "@/domain/privacy";
import { privacyRepository } from "@/repositories/privacyRepository";
export const loadPrivacy = () => privacyRepository.read();
/** Identity verification is switched off, so nobody could qualify: "Verified members" would mean "Only me". */
export const selectableAudiences = () =>
  PRIVACY_AUDIENCES.filter((item) => item.value !== "verified");
export function savePrivacy(field: PrivacyField, audience: string) {
  const option = selectableAudiences().find((item) => item.value === audience);
  const setting = PRIVACY_FIELDS.find((item) => item.key === field);
  if (!option || !setting || ("unavailable" in setting && setting.unavailable)) {
    throw new Error("Choose an available audience and setting.");
  }
  return privacyRepository.update({ [field]: option.value as PrivacyAudience });
}
