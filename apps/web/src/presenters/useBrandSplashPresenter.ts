"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  BRAND_SPLASH,
  SPLASH_FADE_MS,
  SPLASH_MAX_MS,
  SPLASH_MIN_MS,
  SPLASH_START_MS,
} from "@/constants/splash";
import { useGuestRedirect } from "./useGuestRedirect";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** Motion preference as a store, so the snapshot is read during render rather
 *  than set from an effect (mirrors the age gate in useLandingPresenter). */
const subscribeMotion = (onStoreChange: () => void) => {
  const query = window.matchMedia?.(REDUCED_MOTION);
  query?.addEventListener?.("change", onStoreChange);
  return () => query?.removeEventListener?.("change", onStoreChange);
};
const getMotionSnapshot = () => !window.matchMedia?.(REDUCED_MOTION).matches;
const getMotionServerSnapshot = () => true;

/**
 * Entry-screen splash (CEO, 2026-09-15): play the logo animation while the
 * session lookup decides whether this visitor belongs on /home or the landing
 * page. This is what stops a signed-in member seeing the marketing splash for a
 * moment before being bounced — `checking` stays true through the redirect, so
 * the animation covers it until the new route paints.
 *
 * The animation runs to the end before anyone is let through (CEO, 2026-09-15).
 * It is only the gate while it is genuinely playing: reduced motion, a refused
 * autoplay or a failed load fall back to a short floor, and a ceiling covers a
 * clip that stalls and never reports its end.
 */
export function useBrandSplashPresenter() {
  const { checking } = useGuestRedirect();
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [startWindowClosed, setStartWindowClosed] = useState(false);
  const [floorElapsed, setFloorElapsed] = useState(false);
  const [ceilingHit, setCeilingHit] = useState(false);
  const [gone, setGone] = useState(false);
  const animate = useSyncExternalStore(subscribeMotion, getMotionSnapshot, getMotionServerSnapshot);

  useEffect(() => {
    const floor = setTimeout(() => setFloorElapsed(true), SPLASH_MIN_MS);
    const start = setTimeout(() => setStartWindowClosed(true), SPLASH_START_MS);
    const ceiling = setTimeout(() => setCeilingHit(true), SPLASH_MAX_MS);
    return () => {
      clearTimeout(floor);
      clearTimeout(start);
      clearTimeout(ceiling);
    };
  }, []);

  const onPlaying = useCallback(() => setPlaying(true), []);
  const onFinished = useCallback(() => setFinished(true), []);

  // The clip holds the gate while it is playing, or while it still might start.
  const animationRunning = animate && (playing || !startWindowClosed);
  const ready = finished || (!animationRunning && floorElapsed);
  const settled = ceilingHit || (ready && !checking);

  // Stay mounted through the fade, then drop out so nothing overlays the page.
  useEffect(() => {
    if (!settled) return;
    const timer = setTimeout(() => setGone(true), SPLASH_FADE_MS);
    return () => clearTimeout(timer);
  }, [settled]);

  return {
    visible: !gone,
    leaving: settled,
    animate,
    videoSrc: BRAND_SPLASH.videoSrc,
    posterSrc: BRAND_SPLASH.posterSrc,
    label: BRAND_SPLASH.label,
    onPlaying,
    /** Both the clean end and a load failure release the gate. */
    onFinished,
  };
}
