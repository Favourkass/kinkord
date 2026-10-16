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

  it("reminds about each chat with someone new once, then not again this tab", () => {
    chatRulesStore.acknowledge(false);
    chatRulesStore.openNewChat("c1");
    expect(chatRulesStore.pendingNewChat()).toBe("c1");
    chatRulesStore.acknowledge(false);
    expect(chatRulesStore.pendingNewChat()).toBeNull();
    chatRulesStore.closeNewChat("c1");
    chatRulesStore.openNewChat("c2");
    expect(chatRulesStore.pendingNewChat()).toBe("c2");
    chatRulesStore.closeNewChat("c2");
    chatRulesStore.openNewChat("c1");
    expect(chatRulesStore.pendingNewChat()).toBeNull();
  });

  it("only forgets the chat it's told about", () => {
    chatRulesStore.openNewChat("c2");
    chatRulesStore.closeNewChat("c1");
    expect(chatRulesStore.pendingNewChat()).toBe("c2");
  });

  it("is off everywhere once 'never show again' is ticked, and tells its listeners", () => {
    const listener = vi.fn();
    const stop = chatRulesStore.subscribe(listener);
    chatRulesStore.acknowledge(true);
    expect(chatRulesStore.isOffForever()).toBe(true);
    chatRulesStore.openNewChat("c3");
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    chatRulesStore.closeNewChat("c3");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("treats unavailable storage as not acknowledged rather than failing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(chatRulesStore.isAcknowledged()).toBe(false);
  });
});
