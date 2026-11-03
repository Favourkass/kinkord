"use client";

import { useEffect, useMemo, useState } from "react";
import { MODERATION_COPY } from "@/constants/moderation";
import { Routes } from "@/constants/Routes";
import { toMemberRingsVM, type MemberRingsPM } from "@/domain/kinkRings";
import { kinkRingsAdminApi } from "@/services/kinkRings.service";

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
}

/**
 * A member's Kink Rings on their admin page: what each Silver payment
 * brought, who each ring went to and when, when the rest run out, and the
 * rings others gave them. Notes stay between the members: only that one was
 * sent shows here.
 */
export function useAdminMemberRingsPresenter(userId: string, isAdmin: boolean) {
  const copy = MODERATION_COPY.memberRings;
  // Kept with whom it was loaded for, so another member's page never shows it.
  const [loaded, setLoaded] = useState<{ userId: string; rings: MemberRingsPM } | null>(null);
  const [failed, setFailed] = useState<{ userId: string; message: string } | null>(null);

  useEffect(() => {
    if (!isAdmin || !userId) return;
    let live = true;
    kinkRingsAdminApi.forMember(userId).then(
      (rings) => live && setLoaded({ userId, rings }),
      (e: unknown) => live && setFailed({ userId, message: messageOf(e) }),
    );
    return () => {
      live = false;
    };
  }, [isAdmin, userId]);

  const rings = loaded?.userId === userId ? loaded.rings : null;
  const error = failed?.userId === userId ? failed.message : null;
  const vm = useMemo(
    () => (rings ? toMemberRingsVM(rings, copy, Routes.moderationMember) : null),
    [rings, copy],
  );

  return {
    title: copy.title,
    loading: isAdmin && !rings && !error ? copy.loading : null,
    empty: vm?.empty ? copy.empty : null,
    receivedTitle: copy.receivedTitle,
    vm,
    error,
  };
}

export type AdminMemberRingsVM = ReturnType<typeof useAdminMemberRingsPresenter>;
