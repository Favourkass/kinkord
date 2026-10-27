"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { PWA_INSTALL_ARTWORK } from "@/constants/pwa";
import { authClient } from "@/services/authClient";
import { installPromptMemory } from "@/services/installPromptMemory";
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
  // Put off for a week by "Not now", the close button or tapping install (the
  // browser takes it from there). Read on the client; the server offers nothing.
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined" ? false : installPromptMemory.isSnoozed(),
  );
  const [signedIn, setSignedIn] = useState(false);
  const pathname = usePathname();

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
    installPromptMemory.snooze();
    await pwaService.downloadApp();
  }, []);

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
    installPromptMemory.snooze();
  }, []);

  const wouldOffer = !isInstalled && !dismissed && (Boolean(deferredPrompt) || isIos);
  // Signed-in members only: never over the landing page, the age gate or sign-up.
  // Asked again on each page, so it appears once someone signs in, and goes on sign-out.
  useEffect(() => {
    if (!wouldOffer) return;
    let live = true;
    authClient.getSession().then(
      ({ data }) => {
        if (live) setSignedIn(Boolean(data?.user));
      },
      () => {
        if (live) setSignedIn(false);
      },
    );
    return () => {
      live = false;
    };
  }, [pathname, wouldOffer]);

  const isInstallable = wouldOffer && signedIn;

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
