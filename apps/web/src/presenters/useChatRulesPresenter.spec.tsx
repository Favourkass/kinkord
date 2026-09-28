// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { chatRulesStore } from "@/util/chatRules";
import { useChatRulesPresenter } from "./useChatRulesPresenter";

describe("useChatRulesPresenter", () => {
  afterEach(() => {
    cleanup();
    chatRulesStore.reset();
  });

  it("shows the rule to someone who hasn't acknowledged it", () => {
    const { result } = renderHook(() => useChatRulesPresenter());
    expect(result.current.visible).toBe(true);
    expect(result.current.copy.title).toBe("Kinkord Community Rule");
  });

  it("hides it once acknowledged, and remembers 'never again'", () => {
    const { result } = renderHook(() => useChatRulesPresenter());
    act(() => result.current.setNeverShow(true));
    act(() => result.current.acknowledge());
    expect(result.current.visible).toBe(false);
    expect(chatRulesStore.isAcknowledged()).toBe(true);
  });
});
