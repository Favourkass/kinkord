"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BeforeInstallPromptEvent, pwaService } from "@/services/pwa.service";

const DISMISSED_STORAGE_KEY = "kinkord_pwa_install_dismissed";

export interface PwaVM {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  isIos: boolean;
  promptInstall: () => Promise<void>;
  dismissPrompt: () => void;
}

const emptySubscribe = () => () => {};

export function usePwaPresenter(): PwaVM {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installedViaPrompt, setInstalledViaPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(DISMISSED_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const isStandalone = useSyncExternalStore(
    emptySubscribe,
    () => pwaService.isStandalone(),
    () => false
  );

  const isIos = useSyncExternalStore(
    emptySubscribe,
    () => pwaService.isIosDevice(),
    () => false
  );

  const isOffline = useSyncExternalStore(
    (onStoreChange) => pwaService.addNetworkStatusListener(onStoreChange, onStoreChange),
    () => !pwaService.isOnline(),
    () => false
  );

  useEffect(() => {
    void pwaService.registerServiceWorker();

    const unsubscribePrompt = pwaService.setupInstallPromptListener((event) => {
      setDeferredPrompt(event);
    });

    return () => {
      unsubscribePrompt();
    };
  }, []);

  const isInstalled = isStandalone || installedViaPrompt;

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    const outcome = await pwaService.triggerInstall(deferredPrompt);
    if (outcome === "accepted") {
      setInstalledViaPrompt(true);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

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
    promptInstall,
    dismissPrompt,
  };
}
