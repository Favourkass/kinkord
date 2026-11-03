// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useLocationCheckPresenter, type LocationCheckOptions } from "./useLocationCheckPresenter";

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

const service = {
  mode: vi.fn(),
  check: vi.fn(),
  skip: vi.fn(),
};
vi.mock("@/services/locationCheck.service", () => ({
  locationCheckService: {
    mode: () => service.mode(),
    check: (...a: unknown[]) => service.check(...a),
    skip: (...a: unknown[]) => service.skip(...a),
  },
}));

const options = (change: Partial<LocationCheckOptions> = {}): LocationCheckOptions => ({
  country: "NG",
  countryName: "Nigeria",
  active: true,
  onPassed: vi.fn(),
  ...change,
});

describe("useLocationCheckPresenter", () => {
  beforeEach(() => {
    service.mode.mockReset().mockResolvedValue("enforce");
    service.check.mockReset();
    service.skip.mockReset();
  });

  it("explains the check before asking, and links to how it works", async () => {
    const { result } = renderHook(() => useLocationCheckPresenter(options()));
    await waitFor(() => expect(result.current.mode).toBe("enforce"));
    expect(result.current.panel).toMatchObject({
      heading: { plain: "Confirm", highlight: "Where You Are" },
      chose: "You chose Nigeria.",
      privacy: { href: "/privacy/location" },
      share: { label: "Share my location", busy: false, disabled: false },
      skip: null,
      problem: null,
    });
  });

  it("lets them straight through while the check is switched off", async () => {
    service.mode.mockResolvedValue("off");
    const opts = options();
    renderHook(() => useLocationCheckPresenter(opts));
    await waitFor(() => expect(opts.onPassed).toHaveBeenCalledWith(null));
  });

  it("lets them through when the API has no check yet (the app deployed first)", async () => {
    service.mode.mockRejectedValue(new FakeApiError(404, null));
    const opts = options();
    renderHook(() => useLocationCheckPresenter(opts));
    await waitFor(() => expect(opts.onPassed).toHaveBeenCalledWith(null));
  });

  it("can't check before there's a country", () => {
    const { result } = renderHook(() => useLocationCheckPresenter(options({ country: null })));
    expect(result.current.panel.share.disabled).toBe(true);
  });

  it("says the connection is busy, and lets them try again, after too many checks from it", async () => {
    service.check.mockRejectedValue(new FakeApiError(429, null));
    const { result } = renderHook(() => useLocationCheckPresenter(options()));
    await act(async () => result.current.panel.share.onClick());
    await waitFor(() =>
      expect(result.current.panel.problem?.message).toBe(
        "Too many checks from your connection right now. Try again in a few minutes.",
      ),
    );
    expect(result.current.panel.share.disabled).toBe(false);
  });

  it("disables the button for the day once the server pauses their checks", async () => {
    service.check.mockResolvedValue({
      id: "c",
      decision: "paused",
      hint: null,
      enforced: true,
      detectedCountry: null,
    });
    const { result } = renderHook(() => useLocationCheckPresenter(options()));
    await act(async () => result.current.panel.share.onClick());
    await waitFor(() =>
      expect(result.current.panel.problem?.message).toBe(
        "Too many attempts. Please try again in 24 hours.",
      ),
    );
    expect(result.current.panel.share.disabled).toBe(true);
  });

  it("lets them through when the check was switched off meanwhile", async () => {
    service.check.mockRejectedValue(new FakeApiError(400, null));
    const opts = options();
    const { result } = renderHook(() => useLocationCheckPresenter(opts));
    await waitFor(() => expect(result.current.mode).toBe("enforce"));
    service.mode.mockResolvedValue("off");
    await act(async () => result.current.panel.share.onClick());
    await waitFor(() => expect(opts.onPassed).toHaveBeenCalledWith(null));
  });

  it("asks to try again when the connection drops", async () => {
    service.check.mockRejectedValue(new FakeApiError(0, "Network problem"));
    const { result } = renderHook(() => useLocationCheckPresenter(options()));
    await act(async () => result.current.panel.share.onClick());
    await waitFor(() =>
      expect(result.current.panel.problem?.message).toMatch(/couldn't check your connection/),
    );
  });

  it("forgets a problem when the country changes, and shows a reset's reason", async () => {
    service.check.mockResolvedValue({
      id: "c",
      decision: "refused",
      hint: null,
      enforced: true,
      detectedCountry: null,
    });
    const { result, rerender } = renderHook(
      (props: LocationCheckOptions) => useLocationCheckPresenter(props),
      {
        initialProps: options(),
      },
    );
    await act(async () => result.current.panel.share.onClick());
    await waitFor(() => expect(result.current.panel.problem).not.toBeNull());
    rerender(options({ country: "GH", countryName: "Ghana" }));
    expect(result.current.panel.problem).toBeNull();
    act(() => result.current.reset("That check has expired."));
    expect(result.current.panel.notice).toBe("That check has expired.");
  });

  it("only lets them on once Not now is recorded", async () => {
    service.mode.mockResolvedValue("watch");
    service.skip.mockRejectedValue(new Error("offline"));
    const opts = options();
    const { result } = renderHook(() => useLocationCheckPresenter(opts));
    await waitFor(() => expect(result.current.panel.skip).not.toBeNull());
    await act(async () => result.current.panel.skip?.onClick());
    await waitFor(() => expect(result.current.panel.problem).not.toBeNull());
    expect(opts.onPassed).not.toHaveBeenCalled();
  });

  it("asks for the location when Not now is refused because the check stopped watching", async () => {
    service.mode.mockResolvedValueOnce("watch").mockResolvedValue("enforce");
    service.skip.mockRejectedValue(new FakeApiError(400, null));
    const { result } = renderHook(() => useLocationCheckPresenter(options()));
    await waitFor(() => expect(result.current.panel.skip).not.toBeNull());
    await act(async () => result.current.panel.skip?.onClick());
    await waitFor(() =>
      expect(result.current.panel.problem?.message).toBe("Share your location to continue."),
    );
    expect(result.current.panel.skip).toBeNull();
  });

  it("stops passing anyone straight through once the server has refused", async () => {
    service.mode.mockResolvedValue("off");
    const onPassed = vi.fn();
    const { result, rerender } = renderHook(
      (props: LocationCheckOptions) => useLocationCheckPresenter(props),
      { initialProps: options({ active: false, onPassed }) },
    );
    await waitFor(() => expect(result.current.mode).toBe("off"));
    act(() => result.current.reset("That check has expired."));
    rerender(options({ active: true, onPassed }));
    await act(async () => undefined);
    expect(onPassed).not.toHaveBeenCalled();
    expect(result.current.panel.notice).toBe("That check has expired.");
  });

  it("ignores an answer for a country they've since changed", async () => {
    let answer: (value: unknown) => void = () => undefined;
    service.check.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const onPassed = vi.fn();
    const { result, rerender } = renderHook(
      (props: LocationCheckOptions) => useLocationCheckPresenter(props),
      { initialProps: options({ onPassed }) },
    );
    act(() => result.current.panel.share.onClick());
    rerender(options({ country: "GH", countryName: "Ghana", onPassed }));
    await act(async () =>
      answer({ id: "c", decision: "approved", hint: null, enforced: true, detectedCountry: "NG" }),
    );
    expect(onPassed).not.toHaveBeenCalled();
  });
});
