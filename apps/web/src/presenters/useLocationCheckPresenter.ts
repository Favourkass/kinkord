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
  /** Sign-up's check: for a new account, whoever the browser is still signed in as. */
  joining?: boolean;
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
    case "busy":
      return { message: copy.busy, hint: null };
    case "share-needed":
      return { message: copy.shareNeeded, hint: null };
  }
}

/**
 * One country check: say why, ask for the location, let the API decide, and
 * say what to do next. Watching, every result lets the member on and "Not
 * now" is offered; enforcing, only a pass does. The server is the judge: once
 * it has refused (reset with a reason), the mode read when the screen opened
 * no longer lets anyone straight through.
 */
export function useLocationCheckPresenter(opts: LocationCheckOptions) {
  const copy = LOCATION_CHECK_COPY;
  const { country, countryName, active, joining = false, onChangeCountry } = opts;
  const [mode, setMode] = useState<LocationCheckMode | null>(null);
  const [working, setWorking] = useState(false);
  // A problem belongs to the country it was found for; another country starts afresh.
  const [found, setFound] = useState<{ country: string | null; problem: Problem } | null>(null);
  const problem = found && found.country === country ? found.problem : null;
  const setProblem = useCallback(
    (next: Problem | null) => setFound(next ? { country, problem: next } : null),
    [country],
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [insisted, setInsisted] = useState(false);
  // The latest callback and screen, for answers that arrive after things moved on.
  const passed = useRef(opts.onPassed);
  const current = useRef({ active, country });
  useEffect(() => {
    passed.current = opts.onPassed;
    current.current = { active, country };
  }, [opts.onPassed, active, country]);

  const readMode = useCallback(
    () =>
      locationCheckService.mode().then(
        (m) => {
          setMode(m);
          return m;
        },
        // An API without the check (this app deployed first) means none to do;
        // anything else leaves the mode unknown and the check says what's wrong.
        (e: unknown) => {
          if (e instanceof ApiError && e.status === 404) setMode("off");
          return null;
        },
      ),
    [],
  );

  useEffect(() => {
    void readMode();
  }, [readMode]);

  useEffect(() => {
    if (active && mode === "off" && !insisted) passed.current(null);
  }, [active, mode, insisted]);

  /** Hands on a pass only if the screen is still on the country that was checked. */
  const pass = useCallback((checked: string, checkId: string | null) => {
    if (current.current.active && current.current.country === checked) passed.current(checkId);
  }, []);

  const share = useCallback(async () => {
    if (!country || working) return;
    const checked = country;
    setWorking(true);
    setProblem(null);
    setNotice(null);
    try {
      const outcome = outcomeOf(await locationCheckService.check(checked, { joining }));
      if (outcome.kind === "pass") pass(checked, outcome.checkId);
      else setProblem(outcome);
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setProblem({ kind: "busy" });
      } else if (e instanceof ApiError && e.status === 400) {
        // Switched off since the screen opened.
        const now = await readMode();
        if (now === "off") pass(checked, null);
        else setProblem({ kind: "no-connection" });
      } else {
        setProblem({ kind: "no-connection" });
      }
    } finally {
      setWorking(false);
    }
  }, [country, working, joining, pass, readMode, setProblem]);

  const skip = useCallback(async () => {
    if (!country || working) return;
    const checked = country;
    setWorking(true);
    setProblem(null);
    try {
      pass(checked, (await locationCheckService.skip(checked, { joining })).id);
    } catch (e) {
      // Only a recorded "Not now" lets them on: otherwise the next page would
      // send them straight back here.
      if (e instanceof ApiError && e.status === 400) {
        await readMode();
        setProblem({ kind: "share-needed" });
      } else if (e instanceof ApiError && e.status === 429) {
        setProblem({ kind: "busy" });
      } else {
        setProblem({ kind: "no-connection" });
      }
    } finally {
      setWorking(false);
    }
  }, [country, working, joining, pass, readMode, setProblem]);

  /** Back to the start because the server refused: say why, and ask again, whatever the mode said. */
  const reset = useCallback(
    (why: string | null = null) => {
      setProblem(null);
      setNotice(why);
      if (why) {
        setInsisted(true);
        void readMode();
      }
    },
    [readMode, setProblem],
  );

  const panel = useMemo<LocationCheckPanelVM>(() => {
    const shown = problem ? problemCopy(problem) : null;
    return {
      heading: copy.heading,
      intro: copy.intro,
      chose: countryName ? copy.confirming(countryName) : null,
      privacy: { label: copy.privacyLink, href: Routes.locationPrivacy },
      share: {
        label: working ? copy.working : problem ? copy.retry : copy.share,
        busy: working,
        disabled: !country || problem?.kind === "paused",
        onClick: () => void share(),
      },
      skip: mode === "watch" ? { label: copy.skip, onClick: () => void skip() } : null,
      notice,
      problem: shown && {
        ...shown,
        change:
          problem?.kind === "mismatch" && onChangeCountry
            ? {
                label: copy.changeCountry,
                onClick: () => onChangeCountry(problem.detectedCountry),
              }
            : null,
      },
    };
  }, [copy, country, countryName, working, problem, mode, notice, share, skip, onChangeCountry]);

  return { mode, panel, reset };
}
