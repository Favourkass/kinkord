"use client";
import { useEffect, useRef, useState } from "react";
import { WALLET_COPY } from "@/constants/wallet";
import { Routes } from "@/constants/Routes";
import { walletOperationVM, type WalletOperationPM, type WalletSettingsPM } from "@/domain/wallet";
import { ngnToKobo, walletAdminService } from "@/services/wallet.service";
import { useAdminAccessPresenter } from "./useAdminAccessPresenter";
type Action = "verify" | "approve" | "reject" | "paid";
const blank = {
  coinBuy: "",
  coinRedeem: "",
  starBuy: "",
  starRedeem: "",
  crownBuy: "",
  crownRedeem: "",
  minimum: "",
  enabled: false,
};
/** The settings form, drafted from what's saved. */
const formFrom = (next: WalletSettingsPM) => ({
  coinBuy: next.rates ? String(next.rates.coin.buy / 100) : "",
  coinRedeem: next.rates ? String(next.rates.coin.redeem / 100) : "",
  starBuy: next.rates ? String(next.rates.star.buy / 100) : "",
  starRedeem: next.rates ? String(next.rates.star.redeem / 100) : "",
  crownBuy: next.rates ? String(next.rates.crown.buy / 100) : "",
  crownRedeem: next.rates ? String(next.rates.crown.redeem / 100) : "",
  minimum: next.minimumKobo ? String(next.minimumKobo / 100) : "",
  enabled: next.enabled,
});
export function useWalletAdminPresenter() {
  const access = useAdminAccessPresenter(),
    [settings, setSettings] = useState<WalletSettingsPM | null>(null),
    [rows, setRows] = useState<WalletOperationPM[]>([]),
    [kind, setKind] = useState<"purchase" | "withdrawal">("purchase"),
    [status, setStatus] = useState("submitted"),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState(blank),
    [dialog, setDialog] = useState<{ id: string; action: Action } | null>(null),
    [detail, setDetail] = useState("");
  const running = useRef(false);
  // Each queue load is numbered: only the latest (a filter change or a refresh) fills the rows.
  const asked = useRef(0);
  const loadQueue = async () => {
    const ask = ++asked.current;
    const queue = await walletAdminService.queue(kind, status);
    if (ask === asked.current) setRows(queue);
  };
  const refresh = async () => {
    const [next] = await Promise.all([walletAdminService.settings(), loadQueue()]);
    setSettings(next);
    return next;
  };
  // The settings, and the form drafted from them, load once: filtering the queue keeps edits.
  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    walletAdminService.settings().then(
      (next) => {
        if (!live) return;
        setSettings(next);
        setForm(formFrom(next));
      },
      (e) => {
        if (live) setError(e instanceof Error ? e.message : "Could not load wallet settings.");
      },
    );
    return () => {
      live = false;
    };
  }, [access.isAdmin]);
  // The queue follows its filters; a slower load for an earlier filter is dropped.
  useEffect(() => {
    if (!access.isAdmin) return;
    const ask = ++asked.current;
    walletAdminService.queue(kind, status).then(
      (queue) => {
        if (ask !== asked.current) return;
        setRows(queue);
        setError(null);
      },
      (e) => {
        if (ask === asked.current)
          setError(e instanceof Error ? e.message : "Could not load wallet requests.");
      },
    );
  }, [access.isAdmin, kind, status]);
  const run = async (work: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return {
    ...access,
    copy: WALLET_COPY,
    kind,
    status,
    error,
    notice,
    busy,
    form,
    canEdit: settings?.canEdit ?? false,
    canDecide: settings?.canDecide ?? false,
    bankHref: Routes.moderationPayments,
    rows: rows.map(walletOperationVM),
    dialog: dialog
      ? {
          ...dialog,
          detail,
          title: {
            verify: WALLET_COPY.verify,
            approve: WALLET_COPY.approve,
            reject: WALLET_COPY.reject,
            paid: WALLET_COPY.markPaid,
          }[dialog.action],
          hint: {
            verify: WALLET_COPY.verifyHint,
            approve: WALLET_COPY.approveHint,
            reject: WALLET_COPY.rejectHint,
            paid: WALLET_COPY.paidHint,
          }[dialog.action],
        }
      : null,
    onKind: (next: "purchase" | "withdrawal") => {
      setKind(next);
      setStatus(next === "purchase" ? "submitted" : "pending");
      setRows([]);
    },
    onStatus: (next: string) => {
      setStatus(next);
      setRows([]);
    },
    onRefresh: () =>
      run(async () => {
        await refresh();
      }),
    onField: (field: Exclude<keyof typeof blank, "enabled">, value: string) =>
      setForm((previous) => ({ ...previous, [field]: value })),
    onEnabled: (value: boolean) => setForm((previous) => ({ ...previous, enabled: value })),
    onSave: () =>
      run(async () => {
        await walletAdminService.saveSettings({
          rates: {
            coin: { buy: ngnToKobo(form.coinBuy), redeem: ngnToKobo(form.coinRedeem) },
            star: { buy: ngnToKobo(form.starBuy), redeem: ngnToKobo(form.starRedeem) },
            crown: { buy: ngnToKobo(form.crownBuy), redeem: ngnToKobo(form.crownRedeem) },
          },
          minimumKobo: ngnToKobo(form.minimum),
          enabled: form.enabled,
        });
        await refresh();
        setNotice(WALLET_COPY.saved);
      }),
    onAsk: (id: string, action: Action) => {
      setDialog({ id, action });
      setDetail("");
      setError(null);
    },
    onDetail: setDetail,
    onCancel: () => {
      if (!busy) setDialog(null);
    },
    onDecide: () =>
      run(async () => {
        if (!dialog) return;
        await walletAdminService.decide(dialog.id, {
          action: dialog.action,
          ...(dialog.action === "reject"
            ? { note: detail }
            : dialog.action === "paid" || dialog.action === "verify"
              ? { bankReference: detail }
              : {}),
        });
        setDialog(null);
        await refresh();
        setNotice(WALLET_COPY.saved);
      }),
  };
}
