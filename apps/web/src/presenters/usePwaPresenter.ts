"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { PWA_INSTALL_ARTWORK } from "@/constants/pwa";
import { BeforeInstallPromptEvent, pwaService } from "@/services/pwa.service";

export interface PwaVM {
  installArtwork: typeof PWA_INSTALL_ARTWORK;
  isInstallable: boolean;
  isInstalled: boolean;
  isInstalling: boolean;
  isOffline: boolean;
  isIos: boolean;
  isAndroid: boolean;
  canPromptDirectly: boolean;
  showInstallGuide: boolean;
  promptInstall: () => Promise<void>;
  downloadApp: () => Promise<void>;
  openInstallGuide: () => void;
  closeInstallGuide: () => void;
  dismissPrompt: () => void;
}

const emptySubscribe = () => () => {};

export function usePwaPresenter(): PwaVM {
  // PwaWrapper stays mounted during navigation. Dismiss only this visit;
  // a fresh document may offer installation again when the browser supports it.
  const [dismissed, setDismissed] = useState(false);

  const deferredPrompt = useSyncExternalStore(
    (onStoreChange) => pwaService.subscribePrompt(onStoreChange),
    () => pwaService.getDeferredPrompt(),
    () => null,
  );

  const showInstallGuide = useSyncExternalStore(
    (onStoreChange) => pwaService.subscribeGuide(onStoreChange),
    () => pwaService.getIsInstallGuideOpen(),
    () => false,
  );

  const isInstalled = useSyncExternalStore(
    (onStoreChange) => {
      const unsub1 = pwaService.subscribePrompt(onStoreChange);
      const unsub2 = pwaService.subscribeGuide(onStoreChange);
      return () => {
        unsub1();
        unsub2();
      };
    },
    () => pwaService.getIsInstalled(),
    () => false,
  );

  const isInstalling = useSyncExternalStore(
    (onStoreChange) => pwaService.subscribePrompt(onStoreChange),
    () => pwaService.getIsInstalling(),
    () => false,
  );

  const isIos = useSyncExternalStore(
    emptySubscribe,
    () => pwaService.isIosDevice(),
    () => false,
  );

  const isAndroid = useSyncExternalStore(
    emptySubscribe,
    () => pwaService.isAndroidDevice(),
    () => false,
  );

  const isOffline = useSyncExternalStore(
    (onStoreChange) => pwaService.addNetworkStatusListener(onStoreChange, onStoreChange),
    () => !pwaService.isOnline(),
    () => false,
  );

  useEffect(() => {
    void pwaService.registerServiceWorker();
    pwaService.attachGlobalListeners();
  }, []);

  const canPromptDirectly = Boolean(deferredPrompt);

  const promptInstall = useCallback(async () => {
    let prompt = deferredPrompt || pwaService.getDeferredPrompt();
    if (!prompt && typeof window !== "undefined") {
      prompt =
        (window as unknown as { __kinkord_pwa_prompt?: BeforeInstallPromptEvent | null })
          .__kinkord_pwa_prompt ?? null;
    }
    if (prompt) {
      await pwaService.triggerInstall(prompt);
    }
  }, [deferredPrompt]);

  const openInstallGuide = useCallback(() => {
    pwaService.openInstallGuide();
  }, []);

  const closeInstallGuide = useCallback(() => {
    pwaService.closeInstallGuide();
  }, []);

  const downloadApp = useCallback(async () => {
    setDismissed(true);
    await pwaService.downloadApp();
  }, []);

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
  }, []);

  const isInstallable =
    !isInstalled && !dismissed && (Boolean(deferredPrompt) || (isIos && !isInstalled));

  return {
    installArtwork: PWA_INSTALL_ARTWORK,
    isInstallable,
    isInstalled,
    isInstalling,
    isOffline,
    isIos,
    isAndroid,
    canPromptDirectly,
    showInstallGuide,
    promptInstall,
    downloadApp,
    openInstallGuide,
    closeInstallGuide,
    dismissPrompt,
  };
}
