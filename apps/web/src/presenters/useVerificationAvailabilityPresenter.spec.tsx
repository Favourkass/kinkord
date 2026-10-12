// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { status } = vi.hoisted(() => ({ status: vi.fn() }));
vi.mock("@/services/bronzeVerification.service", () => ({
  bronzeVerificationApi: { status },
}));

import { useVerificationAvailabilityPresenter } from "./useVerificationAvailabilityPresenter";

describe("useVerificationAvailabilityPresenter", () => {
  beforeEach(() => status.mockReset());

  it("shows the entry only after the API says verification is available", async () => {
    status.mockResolvedValue({ available: true });
    const { result } = renderHook(() => useVerificationAvailabilityPresenter());
    expect(result.current.available).toBe(false);
    await waitFor(() => expect(result.current.available).toBe(true));
  });

  it("keeps the entry hidden when verification is off", async () => {
    status.mockResolvedValue({ available: false });
    const { result } = renderHook(() => useVerificationAvailabilityPresenter());
    await waitFor(() => expect(status).toHaveBeenCalledOnce());
    expect(result.current.available).toBe(false);
  });
});
