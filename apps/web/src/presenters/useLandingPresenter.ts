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

  return {
    ...baseVM,
    isInstalled: pwa.isInstalled,
    onDownload: () => {
      void pwa.downloadApp();
    },
    downloadCta: {
      ...baseVM.downloadCta,
      label: pwa.isInstalled ? "App Installed" : baseVM.downloadCta.label,
      onClick: () => {
        void pwa.downloadApp();
      },
    },
  };
}
