"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_COPY } from "@/constants/chat";
import { Routes } from "@/constants/Routes";
import { isCrossCountryPremium } from "@/domain/chat";
import { ApiError } from "@/services/apiClient";
import { chatService } from "@/services/chat.service";

/**
 * Behind a profile's Message button: open (or reuse) the thread with this
 * member and land in it. Starting twice is harmless — the pair has one thread.
 */
export function useStartChatPresenter(userId: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [needsSilver, setNeedsSilver] = useState(false);

  useEffect(() => {
    let live = true;
    chatService.start(userId).then(
      ({ conversationId }) => {
        if (live) router.replace(Routes.messageThread(conversationId));
      },
      (e: unknown) => {
        if (!live) return;
        if (e instanceof ApiError && isCrossCountryPremium(e.body)) setNeedsSilver(true);
        else setError(e instanceof Error ? e.message : "Couldn't open the conversation.");
      },
    );
    return () => {
      live = false;
    };
  }, [userId, router]);

  return {
    error,
    /** Writing first to someone in another country is part of Silver: offer it. */
    premium: needsSilver
      ? { text: CHAT_COPY.crossCountry, linkLabel: CHAT_COPY.getSilver, href: Routes.subscription }
      : null,
    backHref: Routes.messages,
  };
}
