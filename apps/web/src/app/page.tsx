"use client";

import BrandSplash from "@/components/ui/BrandSplash";
import SplashScreen from "@/components/landing/SplashScreen";
import { useBrandSplashPresenter } from "@/presenters/useBrandSplashPresenter";
import { useLandingPresenter } from "@/presenters/useLandingPresenter";

export default function Home() {
  // The logo animation covers the entry route while the session lookup runs: a
  // signed-in visitor is bounced to /home behind it, a guest sees the marketing
  // splash once it fades. Both are rendered, so the page is still in the HTML
  // for crawlers and assistive tech while the overlay is up.
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
        />
      )}
      <SplashScreen {...vm} />
    </>
  );
}
