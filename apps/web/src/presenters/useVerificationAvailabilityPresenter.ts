"use client";

import { useEffect, useState } from "react";
import { showsVerificationEntry } from "@/domain/bronzeVerification";
import { bronzeVerificationApi } from "@/services/bronzeVerification.service";

/**
 * Whether Settings lists Verification: while it's open to the member, and
 * also while they have a status there or consent to withdraw, even when it's off.
 */
export function useVerificationAvailabilityPresenter() {
  const [state, setState] = useState<"checking" | "shown" | "hidden">("checking");

  useEffect(() => {
    let live = true;
    bronzeVerificationApi.status().then(
      (status) => {
        if (live) setState(showsVerificationEntry(status) ? "shown" : "hidden");
      },
      () => {
        if (live) setState("hidden");
      },
    );
    return () => {
      live = false;
    };
  }, []);

  return { checking: state === "checking", showEntry: state === "shown" };
}
