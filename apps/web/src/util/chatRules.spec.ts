// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { chatRulesStore } from "./chatRules";

describe("chatRulesStore", () => {
  afterEach(() => {
    chatRulesStore.reset();
    vi.restoreAllMocks();
  });

  it("shows the rule until it's acknowledged", () => {
    expect(chatRulesStore.isAcknowledged()).toBe(false);
    chatRulesStore.acknowledge(false);
    expect(chatRulesStore.isAcknowledged()).toBe(true);
  });

  it("remembers 'never show again' beyond this tab", () => {
    chatRulesStore.acknowledge(true);
    sessionStorage.clear();
    expect(chatRulesStore.isAcknowledged()).toBe(true);
  });

  it("treats unavailable storage as not acknowledged rather than failing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(chatRulesStore.isAcknowledged()).toBe(false);
  });
});
