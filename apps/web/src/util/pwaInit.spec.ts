// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pwaInitScript } from "./pwaInit";

type PromptWindow = Window & { __kinkord_pwa_prompt?: Event | null };

describe("pwaInitScript", () => {
  beforeEach(() => {
    delete (window as PromptWindow).__kinkord_pwa_prompt;
  });

  it("seeds the prompt global and captures beforeinstallprompt before hydration", () => {
    eval(pwaInitScript);

    // The IIFE runs synchronously and initializes the global to null.
    expect((window as PromptWindow).__kinkord_pwa_prompt).toBeNull();

    const ready = vi.fn();
    window.addEventListener("kinkord:prompt-ready", ready);

    const event = new Event("beforeinstallprompt", { cancelable: true });
    const preventDefault = vi.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    // Browser's mini-infobar is suppressed and the event is stashed for later,
    // then a ready signal is broadcast so the service can pick it up.
    expect(preventDefault).toHaveBeenCalled();
    expect((window as PromptWindow).__kinkord_pwa_prompt).toBe(event);
    expect(ready).toHaveBeenCalledTimes(1);

    window.removeEventListener("kinkord:prompt-ready", ready);
  });
});
