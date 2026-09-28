// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";

const access = vi.fn();
vi.mock("@/services/moderation.service", () => ({
  moderationService: { access: () => access() },
}));

describe("useAdminAccessPresenter", () => {
  afterEach(cleanup);

  it("starts out checking, then admits an admin", async () => {
    access.mockResolvedValue({ isAdmin: true });
    const { result } = renderHook(() => useAdminAccessPresenter());
    expect(result.current).toEqual({ checking: true, isAdmin: false });
    await waitFor(() => expect(result.current).toEqual({ checking: false, isAdmin: true }));
  });

  it("treats a failed check (signed out, offline) as no access", async () => {
    access.mockRejectedValue(new Error("401"));
    const { result } = renderHook(() => useAdminAccessPresenter());
    await waitFor(() => expect(result.current).toEqual({ checking: false, isAdmin: false }));
  });
});
