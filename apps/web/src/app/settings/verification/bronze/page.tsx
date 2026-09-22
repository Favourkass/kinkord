import { redirect } from "next/navigation";
import { Routes } from "@/constants/Routes";

/** Legacy member link; the canonical KYC route is /settings/kyc. */
export default function LegacyVerificationPage() {
  redirect(Routes.settingsKyc);
}
