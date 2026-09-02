"use client";

import { usePwaPresenter } from "@/presenters/usePwaPresenter";
import { PwaInstallBanner } from "@/components/ui/PwaInstallBanner";

export function PwaWrapper() {
  const pwa = usePwaPresenter();

  return (
    <PwaInstallBanner
      isInstallable={pwa.isInstallable}
      isIos={pwa.isIos}
      onInstall={pwa.promptInstall}
      onDismiss={pwa.dismissPrompt}
    />
  );
}
