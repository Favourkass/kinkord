"use client";

import SplashScreen from "@/components/landing/SplashScreen";
import { useLandingPresenter } from "@/presenters/useLandingPresenter";

export default function Home() {
  const vm = useLandingPresenter();

  return <SplashScreen {...vm} />;
}
