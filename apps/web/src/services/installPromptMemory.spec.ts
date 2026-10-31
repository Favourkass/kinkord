// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { installPromptMemory } from "./installPromptMemory";

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("installPromptMemory", () => {
  it("puts the prompt off for this visit only: the tab's session, not across visits", () => {
    expect(installPromptMemory.isHiddenThisVisit()).toBe(false);
    installPromptMemory.hideThisVisit();
    expect(installPromptMemory.isHiddenThisVisit()).toBe(true);
    expect(sessionStorage.getItem("kinkord_pwa_install_hidden")).toBe("1");
    expect(localStorage.length).toBe(0);
  });

  it("keeps Don't show again for good", () => {
    expect(installPromptMemory.isOff()).toBe(false);
    installPromptMemory.turnOff();
    expect(installPromptMemory.isOff()).toBe(true);
    expect(localStorage.getItem("kinkord_pwa_install_off")).toBe("1");
  });

  it("forgets the week's snooze and the first banner's dismissal, so everyone is asked again", () => {
    localStorage.setItem("kinkord_pwa_install_snoozed_until", String(Date.now() + 86_400_000));
    localStorage.setItem("kinkord_pwa_install_dismissed", "true");
    installPromptMemory.forgetOldRules();
    expect(localStorage.getItem("kinkord_pwa_install_snoozed_until")).toBeNull();
    expect(localStorage.getItem("kinkord_pwa_install_dismissed")).toBeNull();
    expect(installPromptMemory.isOff()).toBe(false);
  });

  it("shrugs off storage it can't use", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => installPromptMemory.hideThisVisit()).not.toThrow();
    expect(() => installPromptMemory.turnOff()).not.toThrow();
    expect(() => installPromptMemory.forgetOldRules()).not.toThrow();
    expect(installPromptMemory.isHiddenThisVisit()).toBe(false);
    expect(installPromptMemory.isOff()).toBe(false);
  });
});
