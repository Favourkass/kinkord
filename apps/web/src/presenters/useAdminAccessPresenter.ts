"use client";

import { useEffect, useState } from "react";
import { moderationService } from "@/services/moderation.service";

/**
 * Whether the signed-in member may use the admin screens. This only decides
 * what to show: the API refuses every admin call for anyone else regardless.
 */
export function useAdminAccessPresenter() {
  const [state, setState] = useState<"checking" | "admin" | "denied">("checking");

  useEffect(() => {
    let live = true;
    moderationService.access().then(
      (r) => live && setState(r.isAdmin ? "admin" : "denied"),
      () => live && setState("denied"),
    );
    return () => {
      live = false;
    };
  }, []);

  return { checking: state === "checking", isAdmin: state === "admin" };
}
