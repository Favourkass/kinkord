import { permanentRedirect } from "next/navigation";
import { Routes } from "@/constants/Routes";

export default function LegacyVerificationPrivacyRoute() {
  permanentRedirect(Routes.kycPrivacy);
}
