"use client";

import { usePwaPresenter } from "@/presenters/usePwaPresenter";
import { PwaInstallBanner } from "@/components/ui/PwaInstallBanner";
import { PwaInstallModal } from "@/components/ui/PwaInstallModal";

export function PwaWrapper() {
  const pwa = usePwaPresenter();

  return (
    <>
      <PwaInstallBanner
        isInstallable={pwa.isInstallable && !pwa.showInstallGuide}
        isInstalling={pwa.isInstalling}
        artwork={pwa.installArtwork}
        onInstall={pwa.downloadApp}
        onDismiss={pwa.dismissPrompt}
        onNeverShow={pwa.neverShowPrompt}
      />
      <PwaInstallModal
        artwork={pwa.installArtwork}
        isInstalling={pwa.isInstalling}
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
