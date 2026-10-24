import { PRIVACY_CATEGORIES } from "@/constants/privacy";
import { Routes } from "@/constants/Routes";

export function getPrivacyMenuVM() {
  return { title: "Privacy", backHref: Routes.settings, categories: PRIVACY_CATEGORIES };
}
