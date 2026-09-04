"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getLandingVM, LandingVM } from "./getLandingVM";
import { usePwaPresenter } from "./usePwaPresenter";
import { ageGateService } from "@/services/ageGate.service";

export type ClientLandingVM = LandingVM & {
  isInstalled: boolean;
  onDownload: () => void;
  showAgeGate: boolean;
  onConfirmAge: () => void;
  onDeclineAge: () => void;
};

export function useLandingPresenter(): ClientLandingVM {
  const baseVM = useMemo(() => getLandingVM(), []);
  const pwa = usePwaPresenter();

  // Client-only age confirmation. useSyncExternalStore keeps this SSR-safe
  // (server snapshot = unconfirmed, so the gate shows until the client
  // confirms) without a setState-in-effect. Mirrors usePwaPresenter.
  const hasConfirmedAge = useSyncExternalStore(
    (onStoreChange) => ageGateService.subscribe(onStoreChange),
    () => ageGateService.isConfirmed(),
    () => false,
  );

  const downloadLabel = useMemo(() => {
    if (pwa.isInstalled) return "App Installed";
    if (pwa.isInstalling) return "Installing...";
    return baseVM.downloadCta.label;
  }, [pwa.isInstalled, pwa.isInstalling, baseVM.downloadCta.label]);

  return {
    ...baseVM,
    isInstalled: pwa.isInstalled,
    showAgeGate: !hasConfirmedAge,
    onConfirmAge: () => {
      // confirm() notifies subscribers, which re-renders via useSyncExternalStore.
      ageGateService.confirm();
    },
    onDeclineAge: () => {
      if (typeof window !== "undefined") {
        window.location.href = "https://www.google.com";
      }
    },
    onDownload: () => {
      void pwa.downloadApp();
    },
    downloadCta: {
      ...baseVM.downloadCta,
      label: downloadLabel,
      onClick: () => {
        if (pwa.isInstalled || pwa.isInstalling) return;
        // Fires the native install prompt when available, otherwise opens the
        // platform install guide — so the button works on iOS/desktop too.
        void pwa.downloadApp();
      },
    },
  };
}
