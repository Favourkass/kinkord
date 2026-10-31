"use client";

import { PwaInstallBanner } from "@/components/ui/PwaInstallBanner";
import BrandSplash from "@/components/ui/BrandSplash";
import SplashScreen from "@/components/landing/SplashScreen";
import { useBrandSplashPresenter } from "@/presenters/useBrandSplashPresenter";
import { useLandingPresenter } from "@/presenters/useLandingPresenter";

/** The landing page: the brand splash over the marketing screen. */
export default function HomeScreen() {
  // Keep the landing content in the HTML for crawlers, but hide it from sight,
  // keyboard focus and assistive technology until the entry animation is gone.
  const splash = useBrandSplashPresenter();
  const vm = useLandingPresenter();

  return (
    <>
      {splash.visible && (
        <BrandSplash
          videoSrc={splash.videoSrc}
          posterSrc={splash.posterSrc}
          label={splash.label}
          animate={splash.animate}
          leaving={splash.leaving}
          onPlaying={splash.onPlaying}
          onFinished={splash.onFinished}
        />
      )}
      <div hidden={splash.visible}>
        <SplashScreen {...vm} showAgeGate={vm.showAgeGate && !splash.visible} />
      </div>
      {!splash.visible && !vm.showAgeGate && <PwaInstallBanner {...vm.installPrompt} />}
    </>
  );
}
