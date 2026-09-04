"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [hasConfirmedAge, setHasConfirmedAge] = useState<boolean>(true);

  useEffect(() => {
    setHasConfirmedAge(ageGateService.isConfirmed());
  }, []);

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
      ageGateService.confirm();
      setHasConfirmedAge(true);
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
