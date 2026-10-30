"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RING_FLOW_COPY } from "@/constants/kinkRings";
import { Routes } from "@/constants/Routes";
import {
  toRingItemVM,
  toRingHistoryVM,
  type RingInventoryPM,
  type RingRecipientPM,
  type RingPagePM,
  type RingRecipientDraft,
  type RingGiftAssignment,
} from "@/domain/kinkRings";
import { ApiError } from "@/services/apiClient";
import {
  giveRingError,
  kinkRingsApi,
  ringAllocationGifts,
  resizeRingAllocation,
  replaceRingAllocation,
} from "@/services/kinkRings.service";
import { countryName } from "@/util/format";

type Stage =
  | "overview"
  | "inventory"
  | "recipients"
  | "selected"
  | "allocation"
  | "message"
  | "review"
  | "history";
export function useKinkRingsPresenter() {
  const router = useRouter();
  const copy = RING_FLOW_COPY;
  const [pm, setPm] = useState<RingInventoryPM | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("overview");
  const [selected, setSelected] = useState<string[]>([]);
  const [multiple, setMultiple] = useState(false);
  const [tab, setTab] = useState<"friends" | "search">("friends");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [answer, setAnswer] = useState<{
    key: string;
    page: number;
    data: RingPagePM<RingRecipientPM>;
  } | null>(null);
  const [searchRetry, setSearchRetry] = useState(0);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [picked, setPicked] = useState<RingRecipientDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [attempt, setAttempt] = useState<{
    key: string;
    gifts: RingGiftAssignment[];
  } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [giveError, setGiveError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [info, setInfo] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());
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
  const reload = useCallback(async () => {
    try {
      const data = await kinkRingsApi.inventory();
      setPm(data);
      setNow(new Date());
      setError(null);
    } catch (e) {
      if (!signedOut(e)) setError(copy.loadError);
    }
  }, [signedOut, copy.loadError]);
  useEffect(() => {
    let live = true;
    void kinkRingsApi
      .inventory()
      .then((data) => {
        if (live) setPm(data);
      })
      .catch((e) => {
        if (live && !signedOut(e)) setError(copy.loadError);
      });
    return () => {
      live = false;
    };
  }, [signedOut, copy.loadError]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const key = `${tab}:${query.trim()}`;
  useEffect(() => {
    if (stage !== "recipients" || (tab === "search" && query.trim().replace(/^@/, "").length < 2))
      return;
    let live = true;
    const timer = setTimeout(() => {
      void kinkRingsApi
        .recipients(tab, query.trim(), page)
        .then((data) => {
          if (live) {
            setSearchError(null);
            setAnswer((previous) => ({
              key,
              page,
              data: {
                ...data,
                items:
                  page > 1 && previous?.key === key
                    ? [
                        ...previous.data.items,
                        ...data.items.filter(
                          (m) => !previous.data.items.some((p) => p.userId === m.userId),
                        ),
                      ]
                    : data.items,
              },
            }));
          }
        })
        .catch((e) => {
          if (live && !signedOut(e)) setSearchError(copy.searchError);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [stage, tab, query, page, key, signedOut, copy.searchError, searchRetry]);
  const available = pm?.available.filter((r) => new Date(r.expiresAt) > now) ?? [];
  const validSelected = selected.filter((id) => available.some((r) => r.id === id));
  const freshlyExpired = pm?.available.filter((r) => new Date(r.expiresAt) <= now) ?? [];
  const startGift = (ids: string[]) => {
    setAttempt(null);
    setSelected(ids.slice(0, 50));
    setPicked([]);
    setGiveError(null);
    setNote(null);
    setTab("friends");
    setQuery("");
    setPage(1);
    setSearchError(null);
    setStage("recipients");
  };
  const changeSearch = (value: string) => {
    setQuery(value);
    setPage(1);
    setSearchError(null);
  };
  const members = answer?.key === key ? answer.data.items : [];
  const toggleRecipient = (id: string) => {
    const existing = picked.find((p) => p.member.userId === id);
    if (existing) {
      setPicked(picked.filter((p) => p.member.userId !== id));
      return;
    }
    const member = members.find((m) => m.userId === id);
    if (!member) return;
    if (picked.reduce((n, p) => n + p.ringIds.length, 0) >= validSelected.length) {
      setGiveError(copy.maxRecipients);
      return;
    }
    const used = new Set(picked.flatMap((p) => p.ringIds));
    const ringId = validSelected.find((id) => !used.has(id));
    if (!ringId) return;
    setPicked([...picked, { member, ringIds: [ringId], message: "" }]);
    setGiveError(null);
  };
  const quantityTotal = picked.reduce((n, p) => n + p.ringIds.length, 0);
  const draftKey = JSON.stringify({
    selected,
    picked: picked.map((p) => [p.member.username, p.ringIds, p.message]),
  });
  const give = async () => {
    if (lock.current) return;
    let gifts;
    try {
      // Preserve the exact payload after an uncertain response, even if a ring expires before retry.
      gifts =
        attempt?.key === draftKey ? attempt.gifts : ringAllocationGifts(validSelected, picked);
      setAttempt({ key: draftKey, gifts });
    } catch (e) {
      setGiveError(e instanceof Error ? e.message : copy.error);
      return;
    }
    lock.current = true;
    setBusy(true);
    setGiveError(null);
    try {
      await kinkRingsApi.giveSelected(gifts);
      setPm((old) =>
        old
          ? {
              ...old,
              available: old.available.filter((r) => !gifts.some((g) => g.ringId === r.id)),
            }
          : old,
      );
      setAttempt(null);
      setPicked([]);
      setSelected([]);
      setStage("overview");
      setNote(copy.success);
      await reload();
    } catch (e) {
      if (!signedOut(e)) setGiveError(giveRingError(e, copy.error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const loadMore = async (type: "history" | "expired") => {
    if (moreBusy || !pm?.[type].nextPage) return;
    setMoreBusy(true);
    try {
      const next = await kinkRingsApi[type](pm[type].nextPage);
      setPm((old) =>
        old
          ? {
              ...old,
              [type]: {
                ...old[type],
                ...next,
                items: [
                  ...old[type].items,
                  ...next.items.filter((r) => !old[type].items.some((p) => p.id === r.id)),
                ],
              },
            }
          : old,
      );
    } catch (e) {
      if (!signedOut(e)) setError(copy.loadError);
    } finally {
      setMoreBusy(false);
    }
  };
  const recipientVM = (member: RingRecipientPM) => ({
    ...member,
    handle: `@${member.username}`,
    location: [member.city, countryName(member.country)].filter(Boolean).join(", "),
  });
  const detailRing = [...(pm?.available ?? []), ...(pm?.expired.items ?? [])].find(
    (r) => r.id === detail,
  );
  return {
    stage,
    gifting: ["recipients", "selected", "allocation", "message", "review"].includes(stage),
    copy,
    loading: !pm && !error,
    error,
    onRetry: reload,
    buyHref: Routes.subscription,
    hero: "/kink-rings/gold-heart-ring.webp",
    giftHero: "/kink-rings/gift-box.webp",
    count: available.length,
    rings: available.map((r) => ({ ...toRingItemVM(r, now), selected: selected.includes(r.id) })),
    selectedCount: validSelected.length,
    multiple,
    onMultiple: () => {
      setMultiple(!multiple);
      setSelected([]);
    },
    onSelect: (id: string) => {
      setMultiple(true);
      if (selected.includes(id)) setSelected(selected.filter((x) => x !== id));
      else if (selected.length < 50) setSelected([...selected, id]);
      else setNote(copy.max);
    },
    onInventory: () => setStage("inventory"),
    onGift: () => startGift(available.slice(0, 50).map((r) => r.id)),
    onGiftRing: (id: string) => startGift([id]),
    onGiftSelected: () => startGift(validSelected),
    onHistory: () => setStage("history"),
    history: (pm?.history.items ?? []).map((r) => toRingHistoryVM(r, Routes.member)),
    historyMore: Boolean(pm?.history.nextPage),
    onMoreHistory: () => void loadMore("history"),
    expiredCount: (pm?.expired.total ?? 0) + freshlyExpired.length,
    expired: [...freshlyExpired, ...(pm?.expired.items ?? [])].map((r) => toRingItemVM(r, now)),
    expanded,
    onExpand: () => setExpanded(!expanded),
    expiredMore: Boolean(pm?.expired.nextPage),
    onMoreExpired: () => void loadMore("expired"),
    moreBusy,
    tab,
    onTab: (value: "friends" | "search") => {
      setTab(value);
      setQuery("");
      setPage(1);
      setSearchError(null);
    },
    query,
    onQuery: changeSearch,
    recipients: members.map((m) => ({
      ...recipientVM(m),
      selected: picked.some((p) => p.member.userId === m.userId),
    })),
    searchStatus:
      searchError ??
      (tab === "search" && query.trim().replace(/^@/, "").length < 2
        ? copy.searchHint
        : answer?.key !== key || answer.page !== page
          ? copy.loading
          : members.length
            ? null
            : tab === "friends"
              ? copy.emptyFriends
              : copy.emptySearch),
    searchFailed: Boolean(searchError),
    onRetryRecipients: () => {
      setSearchError(null);
      setSearchRetry((n) => n + 1);
    },
    recipientsMore: answer?.key === key && Boolean(answer.data.nextPage),
    onMoreRecipients: () => {
      if (answer?.data.nextPage) setPage(answer.data.nextPage);
    },
    onRecipient: toggleRecipient,
    picked: picked.map((p) => ({
      ...recipientVM(p.member),
      quantity: p.ringIds.length,
      message: p.message,
      rings: p.ringIds.map((id) => {
        const ring = pm?.available.find((r) => r.id === id);
        return ring
          ? toRingItemVM(ring, now)
          : {
              id,
              code: id,
              received: "",
              expires: "Unavailable",
              remaining: "Unavailable",
              urgent: false,
              expired: true,
            };
      }),
    })),
    allocationOptions: (pm?.available ?? [])
      .filter((r) => selected.includes(r.id))
      .map((r) => ({
        value: r.id,
        label: `${toRingItemVM(r, now).code} · ${toRingItemVM(r, now).remaining}`,
      })),
    onRemove: (id: string) => {
      if (!lock.current) setPicked(picked.filter((p) => p.member.userId !== id));
    },
    onQuantity: (id: string, n: number) => {
      if (lock.current) return;
      try {
        setPicked(resizeRingAllocation(picked, id, n, validSelected));
        setGiveError(null);
      } catch (e) {
        setGiveError(e instanceof Error ? e.message : copy.error);
      }
    },
    onRing: (id: string, slot: number, ringId: string) => {
      if (lock.current) return;
      try {
        setPicked(replaceRingAllocation(picked, id, slot, ringId, validSelected));
        setGiveError(null);
      } catch (e) {
        setGiveError(e instanceof Error ? e.message : copy.error);
      }
    },
    onMessage: (id: string, message: string) => {
      if (!lock.current)
        setPicked(
          picked.map((p) =>
            p.member.userId === id ? { ...p, message: message.slice(0, 500) } : p,
          ),
        );
    },
    quantityTotal,
    remaining: Math.max(0, validSelected.length - quantityTotal),
    inventoryRemaining: Math.max(0, available.length - quantityTotal),
    canSubmit:
      picked.length > 0 &&
      (picked.every((p) => p.ringIds.every((id) => validSelected.includes(id))) ||
        attempt?.key === draftKey),
    canContinue:
      picked.length > 0 && picked.every((p) => p.ringIds.every((id) => validSelected.includes(id))),
    onContinue: () => {
      try {
        ringAllocationGifts(validSelected, picked);
      } catch (e) {
        setGiveError(e instanceof Error ? e.message : copy.error);
        return;
      }
      setGiveError(null);
      setStage(
        stage === "recipients"
          ? "selected"
          : stage === "selected"
            ? "allocation"
            : stage === "allocation"
              ? "message"
              : "review",
      );
    },
    onEditRecipients: () => {
      if (!lock.current) setStage("selected");
    },
    onAddMore: () => setStage("recipients"),
    onGive: give,
    busy,
    giveError,
    onBack: () => {
      if (lock.current) return;
      if (stage === "overview") router.push(Routes.home);
      else if (stage === "review") setStage("message");
      else if (stage === "message") setStage("allocation");
      else if (stage === "allocation") setStage("selected");
      else if (stage === "selected") setStage("recipients");
      else if (stage === "recipients") setStage("inventory");
      else setStage("overview");
    },
    info,
    onInfo: () => setInfo(!info),
    detail: detailRing ? toRingItemVM(detailRing, now) : null,
    onDetail: setDetail,
    onCopy: async (id: string) => {
      try {
        await navigator.clipboard.writeText(id);
        setNote(copy.copied);
      } catch {
        setNote(copy.copyFailed);
      }
    },
    note,
    onDismissNote: () => setNote(null),
  };
}
export type KinkRingsScreenVM = ReturnType<typeof useKinkRingsPresenter>;
