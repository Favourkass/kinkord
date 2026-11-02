// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMemberLocationCheckPresenter } from "./useMemberLocationCheckPresenter";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => search,
}));

// Hoisted with the mock, which runs before the rest of the file.
const { FakeApiError } = vi.hoisted(() => ({
  FakeApiError: class FakeApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`HTTP ${status}`);
    }
  },
}));
vi.mock("@/services/apiClient", () => ({ ApiError: FakeApiError }));

const profile = { own: vi.fn(), update: vi.fn() };
vi.mock("@/services/profile.service", () => ({
  profileApi: {
    own: () => profile.own(),
    update: (...a: unknown[]) => profile.update(...a),
  },
}));

const check = vi.fn();
vi.mock("@/services/locationCheck.service", () => ({
  locationCheckService: {
    mode: async () => "enforce",
    check: (...a: unknown[]) => check(...a),
    skip: vi.fn(),
  },
}));

const result = (change: Record<string, unknown> = {}) => ({
  id: "check-1",
  decision: "approved",
  reasons: ["gps_match"],
  enforced: true,
  detectedCountry: "NG",
  ...change,
});

describe("useMemberLocationCheckPresenter", () => {
  beforeEach(() => {
    search = new URLSearchParams({ next: "/messages" });
    replace.mockReset();
    profile.own.mockReset().mockResolvedValue({ country: "NG" });
    profile.update.mockReset().mockResolvedValue({});
    check.mockReset();
  });

  it("confirms the profile country, then returns to where they were", async () => {
    check.mockResolvedValue(result());
    const { result: p } = renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(p.current.loading).toBe(false));
    expect(p.current.choose).toBeNull();
    expect(p.current.panel.chose).toBe("You chose Nigeria.");
    await act(async () => p.current.panel.share.onClick());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/messages"));
    expect(check).toHaveBeenCalledWith("NG");
    expect(profile.update).not.toHaveBeenCalled();
  });

  it("on a mismatch, lets them choose where they are, checks it, and saves it", async () => {
    check
      .mockResolvedValueOnce(
        result({ decision: "mismatch", reasons: ["elsewhere"], detectedCountry: "GH" }),
      )
      .mockResolvedValueOnce(result({ detectedCountry: "GH" }));
    const { result: p } = renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(p.current.loading).toBe(false));
    await act(async () => p.current.panel.share.onClick());
    await waitFor(() => expect(p.current.panel.problem?.change).toBeTruthy());

    act(() => p.current.panel.problem?.change?.onClick());
    expect(p.current.choose?.country.value).toBe("GH");
    expect(p.current.choose?.hint).toBe("Choose your state first.");
    expect(p.current.panel.share.disabled).toBe(true);

    act(() => p.current.choose?.state.onChange("Greater Accra"));
    expect(p.current.panel.share.disabled).toBe(false);
    await act(async () => p.current.panel.share.onClick());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/messages"));
    expect(check).toHaveBeenLastCalledWith("GH");
    expect(profile.update).toHaveBeenCalledWith({
      country: "GH",
      state: "Greater Accra",
      city: null,
    });
  });

  it("starts on choosing for a profile without a country, or when asked to change", async () => {
    profile.own.mockResolvedValue({ country: null });
    const empty = renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(empty.result.current.choose).not.toBeNull());

    search = new URLSearchParams({ change: "1", country: "KE", next: "/profile/edit/location" });
    profile.own.mockResolvedValue({ country: "NG" });
    const changing = renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(changing.result.current.loading).toBe(false));
    expect(changing.result.current.choose?.country.value).toBe("KE");
  });

  it("offers to try again when the profile can't be loaded", async () => {
    profile.own.mockRejectedValueOnce(new FakeApiError(500, null));
    const { result: p } = renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(p.current.loadError).toBe("We couldn't load your profile."));
    expect(p.current.retryLabel).toBe("Try again");
    act(() => p.current.retryLoad());
    await waitFor(() => expect(p.current.loading).toBe(false));
    expect(p.current.loadError).toBeNull();
    expect(p.current.panel.chose).toBe("You chose Nigeria.");
  });

  it("sends a signed-out visitor to log in", async () => {
    profile.own.mockRejectedValue(new FakeApiError(401, null));
    renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("never returns to a page outside the app", async () => {
    search = new URLSearchParams({ next: "https://evil.example" });
    check.mockResolvedValue(result());
    const { result: p } = renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(p.current.loading).toBe(false));
    await act(async () => p.current.panel.share.onClick());
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home"));
  });

  it("says so when the new country can't be saved", async () => {
    search = new URLSearchParams({ change: "1", country: "GH" });
    check.mockResolvedValue(result({ detectedCountry: "GH" }));
    profile.update.mockRejectedValue(new FakeApiError(500, null));
    const { result: p } = renderHook(() => useMemberLocationCheckPresenter());
    await waitFor(() => expect(p.current.loading).toBe(false));
    act(() => p.current.choose?.state.onChange("Greater Accra"));
    await act(async () => p.current.panel.share.onClick());
    await waitFor(() =>
      expect(p.current.saveError).toBe("Your country couldn't be saved. Try again."),
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
