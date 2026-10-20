"use client";

import { useEffect, useState } from "react";
import { moderationService } from "@/services/moderation.service";

/**
 * Whether the signed-in member may use the admin screens, and whether they're
 * a founder (some tools are the founders' alone). This only decides what to
 * show: the API refuses every admin call for anyone else regardless.
 */
export function useAdminAccessPresenter() {
  const [state, setState] = useState<"checking" | "admin" | "denied">("checking");
  const [founder, setFounder] = useState(false);

  useEffect(() => {
    let live = true;
    moderationService.access().then(
      (r) => {
        if (!live) return;
        setState(r.isAdmin ? "admin" : "denied");
        setFounder(Boolean(r.isAdmin && r.isFounder));
      },
      () => live && setState("denied"),
    );
    return () => {
      live = false;
    };
  }, []);

  return { checking: state === "checking", isAdmin: state === "admin", isFounder: founder };
}
