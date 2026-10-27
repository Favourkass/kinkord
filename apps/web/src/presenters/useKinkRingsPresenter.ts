"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KINK_RINGS_COPY } from "@/constants/kinkRings";
import { Routes } from "@/constants/Routes";
import { toKinkRingsVM, type KinkRingsPM } from "@/domain/kinkRings";
import type { MemberCardPM } from "@/domain/member";
import { ApiError } from "@/services/apiClient";
import { giveRingError, kinkRingsApi } from "@/services/kinkRings.service";
import { membersApi } from "@/services/members.service";

/** A search waits this long after the last key, so typing a name is one request. */
const SEARCH_DELAY_MS = 300;
/** Search from this many characters. */
const SEARCH_MIN = 2;
/** How many members a search offers. */
const SEARCH_LIMIT = 6;

const memberHref = (username: string | null) => (username ? Routes.member(username) : null);

export interface RingRecipientVM {
  userId: string;
  name: string;
  handle: string | null;
  avatarUrl: string | null;
}

const toRecipient = (m: MemberCardPM): RingRecipientVM => ({
  userId: m.userId,
  name: m.displayName,
  handle: m.username ? `@${m.username}` : null,
  avatarUrl: m.avatarUrl,
});

/**
 * Kink Rings: the member's rings, and giving one. Find a member by name or
 * username, pick them, confirm, and they get a month of Silver.
 */
export function useKinkRingsPresenter() {
  const router = useRouter();
  const copy = KINK_RINGS_COPY;
  const [pm, setPm] = useState<KinkRingsPM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  /** The last search answered: what was asked, and who matched. */
  const [answer, setAnswer] = useState<{ q: string; items: MemberCardPM[] }>({
    q: "",
    items: [],
  });
  const [picked, setPicked] = useState<MemberCardPM | null>(null);
  const [giving, setGiving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [giveError, setGiveError] = useState<string | null>(null);

  const signedOut = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        router.replace(Routes.login);
        return true;
      }
      return false;
    },
    [router],
  );

  /** Reads the member's rings; `live` says whether the answer is still wanted. */
  const read = useCallback(
    (live: () => boolean) =>
      kinkRingsApi.mine().then(
        (rings) => {
          if (!live()) return;
          setPm(rings);
          setError(null);
        },
        (e) => {
          if (live() && !signedOut(e)) setError(copy.loadFailed);
        },
      ),
    [copy.loadFailed, signedOut],
  );

  useEffect(() => {
    let live = true;
    void read(() => live);
    return () => {
      live = false;
    };
  }, [read]);

  const q = query.trim();
  useEffect(() => {
    if (q.length < SEARCH_MIN) return;
    // A slower earlier search never replaces a later one's answer.
    let live = true;
    const timer = setTimeout(() => {
      membersApi
        .search(q, 1, SEARCH_LIMIT)
        .then((page) => {
          if (live) setAnswer({ q, items: page.items });
        })
        .catch((e) => {
          if (live && !signedOut(e)) setAnswer({ q, items: [] });
        });
    }, SEARCH_DELAY_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, signedOut]);
  const answered = answer.q === q;
  const found = q.length >= SEARCH_MIN && answered ? answer.items : [];
  const searching = q.length >= SEARCH_MIN && !answered;

  const pick = useCallback((m: MemberCardPM) => {
    setPicked(m);
    setQuery("");
    setGiveError(null);
    setNote(null);
  }, []);

  const cancel = useCallback(() => {
    setPicked(null);
    setGiveError(null);
  }, []);

  const give = useCallback(async () => {
    if (!picked?.username || giving) return;
    setGiving(true);
    setGiveError(null);
    try {
      const result = await kinkRingsApi.give(picked.username);
      setNote(copy.given(result.to.displayName));
      setPicked(null);
      await read(() => true);
    } catch (e) {
      if (!signedOut(e)) setGiveError(giveRingError(e, copy.giveFailed));
    } finally {
      setGiving(false);
    }
  }, [copy, giving, read, picked, signedOut]);

  const vm = useMemo(() => (pm ? toKinkRingsVM(pm, copy.labels, memberHref) : null), [pm, copy]);

  return {
    title: copy.title,
    intro: copy.intro,
    loading: !pm && !error,
    loadingLabel: copy.loading,
    error,
    vm,
    /** Giving needs a ring; without one the screen points to Silver. */
    canGive: Boolean(vm && vm.count > 0),
    none: { text: copy.none, action: copy.getSilver, href: Routes.subscription },
    search: {
      label: copy.searchLabel,
      placeholder: copy.searchPlaceholder,
      value: query,
      onChange: setQuery,
      results: found.filter((m) => m.username).map(toRecipient),
      onPick: (userId: string) => {
        const m = found.find((f) => f.userId === userId);
        if (m) pick(m);
      },
      status:
        q.length < SEARCH_MIN
          ? null
          : searching
            ? copy.searching
            : found.length
              ? null
              : copy.noMatches,
    },
    giveLabel: copy.give,
    picked: picked ? toRecipient(picked) : null,
    confirm: picked ? copy.confirm(picked.displayName) : null,
    confirmLabel: giving ? copy.giving : copy.confirmButton,
    cancelLabel: copy.cancel,
    giving,
    onGive: give,
    onCancel: cancel,
    giveError,
    note,
    dismissLabel: copy.dismiss,
    onDismissNote: () => setNote(null),
    givenHeading: copy.givenHeading,
  };
}

export type KinkRingsScreenVM = ReturnType<typeof useKinkRingsPresenter>;
