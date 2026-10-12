"use client";

import { useEffect, useState } from "react";
import { bronzeVerificationApi } from "@/services/bronzeVerification.service";

/** Keeps verification out of Settings until the API explicitly enables it. */
export function useVerificationAvailabilityPresenter() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let live = true;
    bronzeVerificationApi.status().then(
      (status) => {
        if (live) setAvailable(status.available);
      },
      () => {
        if (live) setAvailable(false);
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return { available };
}
