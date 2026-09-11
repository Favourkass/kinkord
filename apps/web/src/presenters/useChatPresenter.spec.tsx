// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useChatPresenter } from "./useChatPresenter";

const replace = vi.fn();
const push = vi.fn();
const router = { replace, push };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const apiGet = vi.fn();
vi.mock("@/services/apiClient", () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public body: unknown,
    ) {
      super(`API ${status}`);
    }
  }
  return { api: { get: (...a: unknown[]) => apiGet(...a) }, ApiError };
});

const me = { id: "current-user", name: "Sir Master", username: "master" };
const profile = { displayName: "Sir Master", avatarUrl: "https://avatar.png" };

const routeGet = (path: unknown) => {
  if (path === "/me") return Promise.resolve(me);
  if (path === "/profile") return Promise.resolve(profile);
  return Promise.reject(new Error(`unexpected ${String(path)}`));
};

describe("useChatPresenter", () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    apiGet.mockReset().mockImplementation(routeGet);
  });

  it("loads user profile and conversations successfully", async () => {
    const { result } = renderHook(() => useChatPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.authUserName).toBe("Sir Master");
    expect(result.current.conversations.length).toBeGreaterThan(0);
    // Rosabel should be among the seeded conversations
    const rosabel = result.current.conversations.find((c) => c.name === "Rosabel");
    expect(rosabel).toBeDefined();
    expect(rosabel?.isPinned).toBe(true);
  });

  it("redirects to login when unauthenticated (401)", async () => {
    const { ApiError } = await import("@/services/apiClient");
    apiGet.mockRejectedValue(new ApiError(401, {}));

    renderHook(() => useChatPresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("selects a conversation and loads its messages", async () => {
    const { result } = renderHook(() => useChatPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.selectConversation("conv-rosabel");
    });

    await waitFor(() => {
      expect(result.current.activeConversationId).toBe("conv-rosabel");
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    expect(result.current.activeConversation?.name).toBe("Rosabel");
  });

  it("sends a message and appends it to active conversation", async () => {
    const { result } = renderHook(() => useChatPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.selectConversation("conv-rosabel");
    });

    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(0));
    const initialCount = result.current.messages.length;

    act(() => {
      result.current.setMessageDraft("Testing message send");
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.messageDraft).toBe("");
    expect(result.current.messages.length).toBe(initialCount + 1);
    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.text).toBe("Testing message send");
    expect(last.isOutgoing).toBe(true);
  });

  it("filters conversations by category", async () => {
    const { result } = renderHook(() => useChatPresenter());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilter("groups");
    });

    expect(result.current.filter).toBe("groups");
    expect(result.current.conversations.every((c) => c.type === "group")).toBe(true);
  });
});
