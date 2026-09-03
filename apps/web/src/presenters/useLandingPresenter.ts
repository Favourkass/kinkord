"use client";

import { useMemo } from "react";
import { getLandingVM, LandingVM } from "./getLandingVM";
import { usePwaPresenter } from "./usePwaPresenter";

export type ClientLandingVM = LandingVM & {
  isInstalled: boolean;
  onDownload: () => void;
};

export function useLandingPresenter(): ClientLandingVM {
  const baseVM = useMemo(() => getLandingVM(), []);
  const pwa = usePwaPresenter();

  const downloadLabel = useMemo(() => {
    if (pwa.isInstalled) return "App Installed";
    if (pwa.isInstalling) return "Installing...";
    return baseVM.downloadCta.label;
  }, [pwa.isInstalled, pwa.isInstalling, baseVM.downloadCta.label]);

  return {
    ...baseVM,
    isInstalled: pwa.isInstalled,
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
