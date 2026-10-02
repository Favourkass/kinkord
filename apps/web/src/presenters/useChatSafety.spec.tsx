// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { CHAT_COPY, blockedNoticeText, reportTitle } from "@/constants/chat";
import type { ChatPeerPM } from "@/domain/chat";
import { ApiError } from "@/services/apiClient";
import { useChatSafety } from "./useChatSafety";

const block = vi.fn();
const unblock = vi.fn();
const report = vi.fn();
vi.mock("@/services/safety.service", () => ({
  safetyService: {
    block: (...a: unknown[]) => block(...a),
    unblock: (...a: unknown[]) => unblock(...a),
    report: (...a: unknown[]) => report(...a),
  },
}));

const peer = (over: Partial<ChatPeerPM> = {}): ChatPeerPM => ({
  userId: "u2",
  username: "ada",
  displayName: "Ada",
  avatarUrl: null,
  online: false,
  blockedByMe: false,
  ...over,
});

describe("useChatSafety", () => {
  let onChange: Mock<() => void>;
  beforeEach(() => {
    onChange = vi.fn<() => void>();
    block.mockReset().mockResolvedValue({ blocked: "u2" });
    unblock.mockReset().mockResolvedValue({ unblocked: "u2" });
    report.mockReset().mockResolvedValue({ id: "r1" });
  });
  afterEach(cleanup);

  const render = (p: ChatPeerPM | null) => renderHook(() => useChatSafety("c1", p, onChange));

  it("offers nothing once the other member is gone", () => {
    const { result } = render(null);
    expect(result.current.menu).toBeNull();
    expect(result.current.blocked).toBeNull();
  });

  it("asks before blocking, then blocks and refreshes the thread", async () => {
    const { result } = render(peer());
    expect(result.current.menu?.items.map((i) => [i.key, i.danger])).toEqual([
      ["report", false],
      ["block", true],
    ]);
    act(() => result.current.menu?.onSelect("block"));
    expect(result.current.blockDialog?.message).toContain("Block Ada?");
    expect(block).not.toHaveBeenCalled();

    act(() => result.current.blockDialog?.onConfirm());
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(block).toHaveBeenCalledWith("u2");
    expect(result.current.blockDialog).toBeNull();
  });

  it("says why when the block can't be made, and keeps the question open", async () => {
    block.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = render(peer());
    act(() => result.current.menu?.onSelect("block"));
    act(() => result.current.blockDialog?.onConfirm());
    await waitFor(() => expect(result.current.error).toBe(CHAT_COPY.safetyFailed));
    expect(result.current.blockDialog).not.toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a blocked member's thread as blocked, with unblock in the menu and in place of the composer", async () => {
    const { result } = render(peer({ blockedByMe: true }));
    expect(result.current.blocked?.text).toBe(blockedNoticeText("Ada"));
    expect(result.current.menu?.items.map((i) => i.key)).toEqual(["report", "unblock"]);
    act(() => result.current.blocked?.onAction());
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    expect(unblock).toHaveBeenCalledWith("u2");
  });

  it("sends a report with the thread, blocking in the same step by default", async () => {
    const { result } = render(peer());
    act(() => result.current.menu?.onSelect("report"));
    const sheet = () => result.current.report!;
    expect(sheet().title).toBe(reportTitle("Ada"));
    expect(sheet().reasons[0]).toEqual({
      value: "underage",
      label: CHAT_COPY.report.reasons.underage,
    });
    expect(sheet().alsoBlock).toEqual({ label: "Also block Ada", checked: true });
    expect(sheet().canSubmit).toBe(false);

    act(() => sheet().onReason("unwanted_sexual"));
    act(() => sheet().onDetails("sent photos I didn't ask for"));
    expect(sheet().canSubmit).toBe(true);
    act(() => sheet().onSubmit());
    await waitFor(() => expect(sheet().sent).toBe(true));
    expect(report).toHaveBeenCalledWith({
      userId: "u2",
      conversationId: "c1",
      reason: "unwanted_sexual",
      details: "sent photos I didn't ask for",
      block: true,
    });
    // The block went with it, so the thread refreshes.
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("reports without blocking when the member unticks it", async () => {
    const { result } = render(peer());
    act(() => result.current.menu?.onSelect("report"));
    act(() => result.current.report?.onReason("spam"));
    act(() => result.current.report?.onToggleBlock());
    act(() => result.current.report?.onSubmit());
    await waitFor(() => expect(result.current.report?.sent).toBe(true));
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ block: false }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the report open with the server's reason when it's refused", async () => {
    report.mockRejectedValueOnce(
      new ApiError(429, { message: "You've sent a lot of reports today." }),
    );
    const { result } = render(peer());
    act(() => result.current.menu?.onSelect("report"));
    act(() => result.current.report?.onReason("spam"));
    act(() => result.current.report?.onSubmit());
    await waitFor(() =>
      expect(result.current.report?.error).toBe("You've sent a lot of reports today."),
    );
    expect(result.current.report?.sent).toBe(false);
  });

  it("doesn't offer to block someone already blocked", () => {
    const { result } = render(peer({ blockedByMe: true }));
    act(() => result.current.menu?.onSelect("report"));
    expect(result.current.report?.alsoBlock).toBeNull();
  });
});
