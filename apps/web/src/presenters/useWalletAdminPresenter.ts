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
  const refresh = async () => {
    const [next, queue] = await Promise.all([
      walletAdminService.settings(),
      walletAdminService.queue(kind, status),
    ]);
    setSettings(next);
    setRows(queue);
    return next;
  };
  useEffect(() => {
    if (!access.isAdmin) return;
    let live = true;
    Promise.all([walletAdminService.settings(), walletAdminService.queue(kind, status)]).then(
      ([next, queue]) => {
        if (!live) return;
        setSettings(next);
        setRows(queue);
        setError(null);
        setForm({
          coinBuy: next.rates ? String(next.rates.coin.buy / 100) : "",
          coinRedeem: next.rates ? String(next.rates.coin.redeem / 100) : "",
          starBuy: next.rates ? String(next.rates.star.buy / 100) : "",
          starRedeem: next.rates ? String(next.rates.star.redeem / 100) : "",
          crownBuy: next.rates ? String(next.rates.crown.buy / 100) : "",
          crownRedeem: next.rates ? String(next.rates.crown.redeem / 100) : "",
          minimum: next.minimumKobo ? String(next.minimumKobo / 100) : "",
          enabled: next.enabled,
        });
      },
      (e) => {
        if (live) setError(e instanceof Error ? e.message : "Could not load wallet requests.");
      },
    );
    return () => {
      live = false;
    };
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
