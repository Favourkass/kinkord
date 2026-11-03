// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useLocationCheckWatcherPresenter } from "./useLocationCheckWatcherPresenter";

const push = vi.fn();
let pathname = "/messages";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const due = vi.fn();
vi.mock("@/services/locationCheck.service", () => ({
  locationCheckService: { due: () => due() },
}));

describe("useLocationCheckWatcherPresenter", () => {
  beforeEach(() => {
    push.mockReset();
    due.mockReset();
    pathname = "/messages";
    window.history.replaceState(null, "", "/messages?c=7");
  });

  it("takes a member whose check is due to it as a page opens, and back after", async () => {
    due.mockResolvedValue(true);
    renderHook(() => useLocationCheckWatcherPresenter());
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/location-check?next=%2Fmessages%3Fc%3D7"),
    );
  });

  it("leaves a member alone when nothing is due", async () => {
    due.mockResolvedValue(false);
    renderHook(() => useLocationCheckWatcherPresenter());
    await waitFor(() => expect(due).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("never asks on signed-out pages, sign-up or the check itself", () => {
    for (const path of ["/", "/signup", "/location-check", "/login"]) {
      pathname = path;
      renderHook(() => useLocationCheckWatcherPresenter());
    }
    expect(due).not.toHaveBeenCalled();
  });

  it("asks at most every two minutes as they move between pages", async () => {
    due.mockResolvedValue(false);
    const { rerender } = renderHook(() => useLocationCheckWatcherPresenter());
    pathname = "/home";
    rerender();
    await waitFor(() => expect(due).toHaveBeenCalledTimes(1));
  });

  it("says nothing when the question fails", async () => {
    due.mockRejectedValue(new Error("offline"));
    renderHook(() => useLocationCheckWatcherPresenter());
    await waitFor(() => expect(due).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });
});
