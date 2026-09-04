"use client";

import { usePwaPresenter } from "@/presenters/usePwaPresenter";
import { PwaInstallBanner } from "@/components/ui/PwaInstallBanner";
import { PwaInstallModal } from "@/components/ui/PwaInstallModal";

export function PwaWrapper() {
  const pwa = usePwaPresenter();

  return (
    <>
      <PwaInstallBanner
        isInstallable={pwa.isInstallable}
        isIos={pwa.isIos}
        onInstall={pwa.promptInstall}
        onDismiss={pwa.dismissPrompt}
      />
      <PwaInstallModal
        open={pwa.showInstallGuide}
        onClose={pwa.closeInstallGuide}
        isIos={pwa.isIos}
        isAndroid={pwa.isAndroid}
        canPromptDirectly={pwa.canPromptDirectly}
        isInstalled={pwa.isInstalled}
        onInstallDirectly={pwa.promptInstall}
      />
    </>
  );
}
