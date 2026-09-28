"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Routes } from "@/constants/Routes";
import { chatService } from "@/services/chat.service";

/**
 * Behind a profile's Message button: open (or reuse) the thread with this
 * member and land in it. Starting twice is harmless — the pair has one thread.
 */
export function useStartChatPresenter(userId: string) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    chatService.start(userId).then(
      ({ conversationId }) => {
        if (live) router.replace(Routes.messageThread(conversationId));
      },
      (e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Couldn't open the conversation.");
      },
    );
    return () => {
      live = false;
    };
  }, [userId, router]);

  return { error, backHref: Routes.messages };
}
