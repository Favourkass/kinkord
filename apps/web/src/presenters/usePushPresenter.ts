"use client";

import { useCallback, useEffect, useState } from "react";
import { PUSH_COPY } from "@/constants/push";
import { shouldPromptForPush, type PushState } from "@/domain/push";
import { pushService } from "@/services/push.service";

/** "Not now" on the prompt card, remembered on this device only. */
const DISMISS_KEY = "kinkord:push-prompt-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Private mode or blocked storage: the card just comes back next time.
  }
}

/** Push notifications for the settings row and the "turn them on" card. */
export function usePushPresenter() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let live = true;
    pushService.state().then(
      (s) => live && setState(s),
      () => live && setState("unsupported"),
    );
    return () => {
      live = false;
    };
  }, []);

  const run = useCallback(async (change: () => Promise<PushState>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await change();
      setState(next);
      return next;
    } catch {
      setError(PUSH_COPY.failed);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const enable = useCallback(async () => {
    const next = await run(() => pushService.enable());
    // A first notification straight away shows it works on this device.
    if (next === "on") void pushService.test().catch(() => undefined);
  }, [run]);

  const disable = useCallback(() => void run(() => pushService.disable()), [run]);

  const dismiss = useCallback(() => {
    writeDismissed();
    setDismissed(true);
  }, []);

  const canToggle = state === "on" || state === "off";
  return {
    settings: {
      heading: PUSH_COPY.settingsHeading,
      label: PUSH_COPY.settingsLabel,
      description: state ? PUSH_COPY.describe[state] : PUSH_COPY.working,
      actionLabel: busy ? PUSH_COPY.working : state === "on" ? PUSH_COPY.turnOff : PUSH_COPY.turnOn,
      actionDisabled: busy || !canToggle,
      onAction: state === "on" ? disable : () => void enable(),
      error,
    },
    prompt: shouldPromptForPush(state, dismissed)
      ? {
          text: state === "install" ? PUSH_COPY.prompt.install : PUSH_COPY.prompt.enable,
          actionLabel: state === "install" ? null : PUSH_COPY.turnOn,
          dismissLabel: PUSH_COPY.prompt.dismiss,
          busy,
          onAction: () => void enable(),
          onDismiss: dismiss,
        }
      : null,
  };
}
