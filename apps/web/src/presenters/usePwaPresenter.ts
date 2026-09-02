"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BeforeInstallPromptEvent, pwaService } from "@/services/pwa.service";

const DISMISSED_STORAGE_KEY = "kinkord_pwa_install_dismissed";

export interface PwaVM {
  isInstallable: boolean;
  isInstalled: boolean;
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
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(DISMISSED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const deferredPrompt = useSyncExternalStore(
    (onStoreChange) => pwaService.subscribePrompt(onStoreChange),
    () => pwaService.getDeferredPrompt(),
    () => null
  );

  const showInstallGuide = useSyncExternalStore(
    (onStoreChange) => pwaService.subscribeGuide(onStoreChange),
    () => pwaService.getIsInstallGuideOpen(),
    () => false
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
    () => false
  );

  const isIos = useSyncExternalStore(
    emptySubscribe,
    () => pwaService.isIosDevice(),
    () => false
  );

  const isAndroid = useSyncExternalStore(
    emptySubscribe,
    () => pwaService.isAndroidDevice(),
    () => false
  );

  const isOffline = useSyncExternalStore(
    (onStoreChange) => pwaService.addNetworkStatusListener(onStoreChange, onStoreChange),
    () => !pwaService.isOnline(),
    () => false
  );

  useEffect(() => {
    void pwaService.registerServiceWorker();
    pwaService.attachGlobalListeners();
  }, []);

  const canPromptDirectly = Boolean(deferredPrompt);

  const promptInstall = useCallback(async () => {
    if (deferredPrompt) {
      await pwaService.triggerInstall(deferredPrompt);
    }
  }, [deferredPrompt]);

  const openInstallGuide = useCallback(() => {
    pwaService.openInstallGuide();
  }, []);

  const closeInstallGuide = useCallback(() => {
    pwaService.closeInstallGuide();
  }, []);

  const downloadApp = useCallback(async () => {
    await pwaService.downloadApp();
  }, []);

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_STORAGE_KEY, "true");
    } catch {
      // Ignore storage errors
    }
  }, []);

  const isInstallable =
    !isInstalled &&
    !dismissed &&
    (Boolean(deferredPrompt) || (isIos && !isInstalled));

  return {
    isInstallable,
    isInstalled,
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
