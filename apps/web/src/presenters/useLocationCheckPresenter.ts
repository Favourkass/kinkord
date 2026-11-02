"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOCATION_CHECK_COPY } from "@/constants/locationCheck";
import { Routes } from "@/constants/Routes";
import {
  outcomeOf,
  type LocationCheckMode,
  type LocationCheckOutcome,
} from "@/domain/locationCheck";
import { ApiError } from "@/services/apiClient";
import { locationCheckService } from "@/services/locationCheck.service";

/** Everything LocationCheckPanel shows, display-ready. */
export interface LocationCheckPanelVM {
  heading: { plain: string; highlight: string };
  intro: readonly string[];
  chose: string | null;
  privacy: { label: string; href: string };
  share: { label: string; busy: boolean; disabled: boolean; onClick: () => void };
  /** "Not now", only while the check is watching. */
  skip: { label: string; onClick: () => void } | null;
  notice: string | null;
  problem: {
    message: string;
    hint: string | null;
    change: { label: string; onClick: () => void } | null;
  } | null;
}

export interface LocationCheckOptions {
  /** The country to confirm; nothing can be checked until there is one. */
  country: string | null;
  /** Its name, for the "You chose …" line. */
  countryName: string | null;
  /** Whether the check is on screen; a switched-off check lets them straight through only then. */
  active: boolean;
  /** They may carry on, with the check that let them (null when none was needed). */
  onPassed: (checkId: string | null) => void;
  /** "Change country" on a mismatch, given where the GPS put them; left out where there's nowhere to change it. */
  onChangeCountry?: (detectedCountry: string | null) => void;
}

type Problem = Exclude<LocationCheckOutcome, { kind: "pass" }>;

function problemCopy(problem: Problem) {
  const copy = LOCATION_CHECK_COPY.problems;
  switch (problem.kind) {
    case "mismatch":
      return { message: copy.mismatch, hint: problem.vpn ? copy.vpnHint : null };
    case "allow-location":
      return { message: copy.allowLocation, hint: null };
    case "no-location":
      return { message: copy.noLocation, hint: null };
    case "no-connection":
      return { message: copy.noConnection, hint: null };
    case "refused":
      return { message: copy.refused, hint: null };
    case "paused":
      return { message: copy.paused, hint: null };
  }
}

/**
 * One country check: say why, ask for the location, let the API decide, and
 * say what to do next. Watching, every result lets the member on and "Not
 * now" is offered; enforcing, only a pass does.
 */
export function useLocationCheckPresenter(opts: LocationCheckOptions) {
  const copy = LOCATION_CHECK_COPY;
  const [mode, setMode] = useState<LocationCheckMode | null>(null);
  const [working, setWorking] = useState(false);
  // A problem belongs to the country it was found for; another country starts afresh.
  const [found, setFound] = useState<{ country: string | null; problem: Problem } | null>(null);
  const problem = found && found.country === opts.country ? found.problem : null;
  const setProblem = useCallback(
    (next: Problem | null) => setFound(next ? { country: opts.country, problem: next } : null),
    [opts.country],
  );
  const [notice, setNotice] = useState<string | null>(null);
  // The latest callback, for the async check and the switched-off pass to call.
  const passed = useRef(opts.onPassed);
  useEffect(() => {
    passed.current = opts.onPassed;
  }, [opts.onPassed]);

  useEffect(() => {
    let live = true;
    locationCheckService.mode().then(
      (m) => live && setMode(m),
      // An API without the check (this app deployed first) means none to do; anything
      // else leaves the mode unknown, and the check itself says what's wrong. The
      // server decides either way: an account it needs a check for is refused without one.
      (e: unknown) => live && e instanceof ApiError && e.status === 404 && setMode("off"),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (opts.active && mode === "off") passed.current(null);
  }, [opts.active, mode]);

  const share = useCallback(async () => {
    if (!opts.country || working) return;
    setWorking(true);
    setProblem(null);
    setNotice(null);
    try {
      const outcome = outcomeOf(await locationCheckService.check(opts.country));
      if (outcome.kind === "pass") passed.current(outcome.checkId);
      else setProblem(outcome);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setProblem({ kind: "paused" });
      } else if (e instanceof ApiError && e.status === 400) {
        // Switched off since the screen opened.
        const now = await locationCheckService.mode().catch(() => null);
        if (now) setMode(now);
        if (now === "off") passed.current(null);
        else setProblem({ kind: "no-connection" });
      } else {
        setProblem({ kind: "no-connection" });
      }
    } finally {
      setWorking(false);
    }
  }, [opts.country, working, setProblem]);

  const skip = useCallback(async () => {
    if (!opts.country || working) return;
    setWorking(true);
    try {
      passed.current((await locationCheckService.skip(opts.country)).id);
    } catch {
      // Watching never stops anyone, even when the skip can't be recorded.
      passed.current(null);
    } finally {
      setWorking(false);
    }
  }, [opts.country, working]);

  /** Back to the start, optionally saying why (an expired check). */
  const reset = useCallback(
    (why: string | null = null) => {
      setProblem(null);
      setNotice(why);
    },
    [setProblem],
  );

  const panel = useMemo<LocationCheckPanelVM>(() => {
    const shown = problem ? problemCopy(problem) : null;
    return {
      heading: copy.heading,
      intro: copy.intro,
      chose: opts.countryName ? copy.confirming(opts.countryName) : null,
      privacy: { label: copy.privacyLink, href: Routes.locationPrivacy },
      share: {
        label: working ? copy.working : problem ? copy.retry : copy.share,
        busy: working,
        disabled: !opts.country || problem?.kind === "paused",
        onClick: () => void share(),
      },
      skip: mode === "watch" ? { label: copy.skip, onClick: () => void skip() } : null,
      notice,
      problem: shown && {
        ...shown,
        change:
          problem?.kind === "mismatch" && opts.onChangeCountry
            ? {
                label: copy.changeCountry,
                onClick: () => opts.onChangeCountry?.(problem.detectedCountry),
              }
            : null,
      },
    };
  }, [copy, opts, working, problem, mode, notice, share, skip]);

  return { mode, panel, reset };
}
