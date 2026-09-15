// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrandSplashPresenter } from "./useBrandSplashPresenter";
import { SPLASH_FADE_MS, SPLASH_MAX_MS, SPLASH_MIN_MS, SPLASH_START_MS } from "@/constants/splash";

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

  it("lets the animation finish even when the session check returns at once", async () => {
    const { result, rerender } = renderHook(() => useBrandSplashPresenter());
    act(() => result.current.onPlaying());
    checking.value = false;
    rerender();

    // Well past the fallback floor: a playing clip is not cut short by it.
    await advance(SPLASH_MIN_MS + SPLASH_START_MS);
    expect(result.current.leaving).toBe(false);

    act(() => result.current.onFinished());
    expect(result.current.leaving).toBe(true);

    await advance(SPLASH_FADE_MS);
    expect(result.current.visible).toBe(false);
  });

  it("still waits for a slow session check after the animation ends", async () => {
    const { result } = renderHook(() => useBrandSplashPresenter());
    act(() => result.current.onPlaying());
    act(() => result.current.onFinished());
    await advance(SPLASH_MIN_MS);
    expect(result.current.leaving).toBe(false); // checking is still true
  });

  it("falls back to the floor when autoplay is refused and never starts", async () => {
    const { result, rerender } = renderHook(() => useBrandSplashPresenter());
    checking.value = false;
    rerender();

    await advance(SPLASH_MIN_MS);
    expect(result.current.leaving).toBe(false); // still inside the start window

    await advance(SPLASH_START_MS - SPLASH_MIN_MS);
    expect(result.current.leaving).toBe(true);
  });

  it("releases as soon as a failed video reports back", async () => {
    const { result, rerender } = renderHook(() => useBrandSplashPresenter());
    checking.value = false;
    rerender();
    act(() => result.current.onFinished()); // onError is wired to this
    expect(result.current.leaving).toBe(true);
  });

  it("gives up at the ceiling so a stalled clip cannot trap anyone", async () => {
    const { result } = renderHook(() => useBrandSplashPresenter());
    act(() => result.current.onPlaying());
    await advance(SPLASH_MAX_MS);
    expect(result.current.leaving).toBe(true);
    await advance(SPLASH_FADE_MS);
    expect(result.current.visible).toBe(false);
  });

  it("uses the floor, not the clip, when the viewer asked for reduced motion", async () => {
    window.matchMedia = mediaQuery(true);
    const { result, rerender } = renderHook(() => useBrandSplashPresenter());
    expect(result.current.animate).toBe(false);
    expect(result.current.posterSrc).toMatch(/\.jpg$/);

    checking.value = false;
    rerender();
    await advance(SPLASH_MIN_MS);
    expect(result.current.leaving).toBe(true);
  });
});
