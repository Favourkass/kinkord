"use client";

import SplashScreen from "@/components/landing/SplashScreen";
import { useLandingPresenter } from "@/presenters/useLandingPresenter";
import { useGuestRedirect } from "@/presenters/useGuestRedirect";

export default function Home() {
  // If the visitor already has a session, bounce them to /home instead of the
  // marketing splash. Rendered optimistically so the splash still SSRs for
  // logged-out visitors; only signed-in users get redirected client-side.
  useGuestRedirect();
  const vm = useLandingPresenter();

  return <SplashScreen {...vm} />;
}
