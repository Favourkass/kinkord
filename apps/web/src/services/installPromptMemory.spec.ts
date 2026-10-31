// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { INSTALL_PROMPT_SNOOZE_DAYS, installPromptMemory } from "./installPromptMemory";

const DAY = 86_400_000;
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("installPromptMemory", () => {
  it("keeps the prompt away for a week after Not now, then lets it back", () => {
    const now = Date.UTC(2026, 9, 27);
    expect(installPromptMemory.isSnoozed(now)).toBe(false);
    installPromptMemory.snooze(now);
    expect(installPromptMemory.isSnoozed(now + 6 * DAY)).toBe(true);
    expect(installPromptMemory.isSnoozed(now + INSTALL_PROMPT_SNOOZE_DAYS * DAY)).toBe(false);
  });

  it("clears the old banner's dismissal once the new prompt is put off", () => {
    localStorage.setItem("kinkord_pwa_install_dismissed", "true");
    expect(installPromptMemory.isSnoozed()).toBe(false);
    installPromptMemory.snooze();
    expect(localStorage.getItem("kinkord_pwa_install_dismissed")).toBeNull();
  });

  it("notifies other prompt instances and tabs, and unsubscribes cleanly", () => {
    const changed = vi.fn();
    const unsubscribe = installPromptMemory.subscribe(changed);
    installPromptMemory.snooze();
    expect(changed).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(changed).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new StorageEvent("storage", { key: "kinkord_pwa_install_snoozed_until" }));
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
    installPromptMemory.snooze();
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it("shrugs off storage it can't use", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => installPromptMemory.snooze()).not.toThrow();
    expect(installPromptMemory.isSnoozed()).toBe(false);
  });
});
