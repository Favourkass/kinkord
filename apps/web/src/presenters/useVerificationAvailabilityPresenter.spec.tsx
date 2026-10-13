// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { status } = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock("@/services/bronzeVerification.service", () => ({
  bronzeVerificationApi: { status },
}));

import { useVerificationAvailabilityPresenter } from "./useVerificationAvailabilityPresenter";

const off = { available: false, withdrawable: false, status: "not_started" };

describe("useVerificationAvailabilityPresenter", () => {
  // A block body: a function returned from beforeEach would run as its teardown.
  beforeEach(() => {
    status.mockReset();
  });

  it("shows the entry once the API says verification is available", async () => {
    status.mockResolvedValue({ ...off, available: true });
    const { result } = renderHook(() => useVerificationAvailabilityPresenter());
    expect(result.current).toEqual({ checking: true, showEntry: false });
    await waitFor(() => expect(result.current).toEqual({ checking: false, showEntry: true }));
  });

  it("keeps the entry hidden when verification is off and there's nothing there", async () => {
    status.mockResolvedValue(off);
    const { result } = renderHook(() => useVerificationAvailabilityPresenter());
    await waitFor(() => expect(result.current).toEqual({ checking: false, showEntry: false }));
  });

  it("keeps the entry while off for a member who can withdraw or has a status", async () => {
    for (const pm of [
      { ...off, withdrawable: true },
      { ...off, status: "verified" },
      { ...off, status: "rejected" },
    ]) {
      status.mockResolvedValue(pm);
      const { result, unmount } = renderHook(() => useVerificationAvailabilityPresenter());
      await waitFor(() => expect(result.current).toEqual({ checking: false, showEntry: true }));
      unmount();
    }
  });

  it("hides the entry when the status can't be loaded", async () => {
    status.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useVerificationAvailabilityPresenter());
    await waitFor(() => expect(result.current).toEqual({ checking: false, showEntry: false }));
  });
});
