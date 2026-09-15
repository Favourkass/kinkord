// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrandSplashPresenter } from "./useBrandSplashPresenter";
import { SPLASH_FADE_MS, SPLASH_MAX_MS, SPLASH_MIN_MS } from "@/constants/splash";

const checking = { value: true };
vi.mock("./useGuestRedirect", () => ({
  useGuestRedirect: () => ({ checking: checking.value }),
}));

const mediaQuery = (matches: boolean) =>
  vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof matchMedia;

const advance = async (ms: number) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  checking.value = true;
  window.matchMedia = mediaQuery(false);
});

afterEach(() => vi.useRealTimers());

describe("useBrandSplashPresenter", () => {
  it("covers the entry screen from the first paint", () => {
    const { result } = renderHook(() => useBrandSplashPresenter());
    expect(result.current.visible).toBe(true);
    expect(result.current.leaving).toBe(false);
    expect(result.current.animate).toBe(true);
    expect(result.current.videoSrc).toMatch(/\.mp4$/);
  });

  it("holds for the floor even when the session check returns at once", async () => {
    const { result, rerender } = renderHook(() => useBrandSplashPresenter());
    checking.value = false;
    rerender();
    expect(result.current.leaving).toBe(false);

    await advance(SPLASH_MIN_MS);
    expect(result.current.leaving).toBe(true);
    expect(result.current.visible).toBe(true); // still fading out

    await advance(SPLASH_FADE_MS);
    expect(result.current.visible).toBe(false);
  });

  it("keeps covering a slow session check past the floor", async () => {
    const { result } = renderHook(() => useBrandSplashPresenter());
    await advance(SPLASH_MIN_MS + 1000);
    expect(result.current.leaving).toBe(false);
    expect(result.current.visible).toBe(true);
  });

  it("gives up at the ceiling so a hung API cannot trap anyone", async () => {
    const { result } = renderHook(() => useBrandSplashPresenter());
    await advance(SPLASH_MAX_MS);
    expect(result.current.leaving).toBe(true);
    await advance(SPLASH_FADE_MS);
    expect(result.current.visible).toBe(false);
  });

  it("falls back to the still poster when the viewer asked for reduced motion", () => {
    window.matchMedia = mediaQuery(true);
    const { result } = renderHook(() => useBrandSplashPresenter());
    expect(result.current.animate).toBe(false);
    expect(result.current.posterSrc).toMatch(/\.jpg$/);
  });
});
