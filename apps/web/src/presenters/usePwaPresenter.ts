"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { PWA_INSTALL_ARTWORK } from "@/constants/pwa";
import { Routes } from "@/constants/Routes";
import { ageGateService } from "@/services/ageGate.service";
import { installPromptMemory } from "@/services/installPromptMemory";
import { BeforeInstallPromptEvent, pwaService } from "@/services/pwa.service";

export interface PwaVM {
  /** The still shows at once; `motion` is null where it isn't welcome. */
  installArtwork: Omit<typeof PWA_INSTALL_ARTWORK, "motion"> & { motion: string | null };
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
  neverShowPrompt: () => void;
}

const emptySubscribe = () => () => {};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onStoreChange: () => void) => {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onStoreChange);
  return () => query?.removeEventListener?.("change", onStoreChange);
};

export function usePwaPresenter(): PwaVM {
  // Every visit to someone without the app, until "Don't show again"; "Not now",
  // closing it or tapping install put it off for the rest of this visit only.
  // Read on the client; the server offers nothing.
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined"
      ? false
      : installPromptMemory.isOff() || installPromptMemory.isHiddenThisVisit(),
  );
  const pathname = usePathname();
  // The landing page asks a visitor's age first: the prompt waits until they've answered.
  const ageConfirmed = useSyncExternalStore(
    (onStoreChange) => ageGateService.subscribe(onStoreChange),
    () => ageGateService.isConfirmed(),
    () => false,
  );
  // The motion only where it's welcome: not on a data saver or 2G, nor for reduced motion.
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia?.(REDUCED_MOTION).matches ?? false,
    () => false,
  );
  const sparingData = useSyncExternalStore(
    emptySubscribe,
    () => pwaService.isSlowOrSavingData(),
    () => false,
  );

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
    installPromptMemory.forgetOldRules();
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
    installPromptMemory.hideThisVisit();
    await pwaService.downloadApp();
  }, []);

  const dismissPrompt = useCallback(() => {
    setDismissed(true);
    installPromptMemory.hideThisVisit();
  }, []);

  const neverShowPrompt = useCallback(() => {
    setDismissed(true);
    installPromptMemory.turnOff();
  }, []);

  // Without the app: the browser offers to install it, or it's an iPhone, where
  // nothing can tell (the guide covers it). The installed app never offers it.
  const wouldOffer = !isInstalled && !dismissed && (Boolean(deferredPrompt) || isIos);
  const playMotion = !reducedMotion && !sparingData;

  // Fetch the still as soon as the card may be needed (say, while the age question
  // is up), so it shows the moment the card opens; the motion streams in after.
  useEffect(() => {
    if (wouldOffer) void pwaService.preloadImage(PWA_INSTALL_ARTWORK.still).catch(() => undefined);
  }, [wouldOffer]);

  const isInstallable = wouldOffer && (pathname !== Routes.home || ageConfirmed);

  return {
    installArtwork: {
      ...PWA_INSTALL_ARTWORK,
      motion: playMotion ? PWA_INSTALL_ARTWORK.motion : null,
    },
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
    neverShowPrompt,
  };
}
