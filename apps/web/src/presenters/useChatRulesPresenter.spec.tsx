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

  it("reminds again when the member opens a chat with someone new, once", () => {
    chatRulesStore.acknowledge(false);
    const { result } = renderHook(() => useChatRulesPresenter());
    expect(result.current.visible).toBe(false);
    act(() => chatRulesStore.openNewChat("c1"));
    expect(result.current.visible).toBe(true);
    act(() => result.current.acknowledge());
    expect(result.current.visible).toBe(false);
    act(() => chatRulesStore.closeNewChat("c1"));
    act(() => chatRulesStore.openNewChat("c1"));
    expect(result.current.visible).toBe(false);
  });

  it("never shows after 'never show again', even for someone new", () => {
    chatRulesStore.acknowledge(true);
    const { result } = renderHook(() => useChatRulesPresenter());
    act(() => chatRulesStore.openNewChat("c1"));
    expect(result.current.visible).toBe(false);
  });
});
