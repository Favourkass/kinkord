"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import VerifiedMark from "@/components/brand/VerifiedMark";

interface LinkVM {
  linkLabel: string;
  href: string;
}

export interface BronzeVerificationViewProps {
  title: string;
  intro: string;
  status: {
    heading: string;
    label: string;
    detail: string;
    /** Why the last check didn't pass, when that's where the member stands. */
    failure: string | null;
    tone: "neutral" | "good" | "warn" | "bad";
  };
  attempts: string | null;
  badgeHint: ({ text: string } & LinkVM) | null;
  unavailable: string | null;
  needs: ({ heading: string; text: string; items: string[] } & LinkVM) | null;
  settling: string | null;
  checks: { heading: string; items: readonly string[]; note: string };
  privacy: { label: string; href: string };
  consent: { text: string; checked: boolean; onChange: (checked: boolean) => void } | null;
  outdatedPage: string | null;
  start: {
    label: string;
    visible: boolean;
    enabled: boolean;
    /** Why the button is held, shown under it. */
    hint: string | null;
    onClick: () => void;
  } | null;
  resume: { label: string; enabled: boolean; onClick: () => void } | null;
  refresh: { label: string; onClick: () => void } | null;
  withdraw: { label: string; onClick: () => void } | null;
  withdrawConfirm: {
    title: string;
    body: string;
    confirmLabel: string;
    busyLabel: string;
    cancelLabel: string;
    busy: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
  notice: string | null;
  actionError: string | null;
}

const card = "rounded-[16px] border border-app-card-border bg-app-card p-[18px]";
const toneClass = {
  neutral: "text-app-value",
  good: "text-kink-gold-bright",
  warn: "text-kink-amber",
  bad: "text-app-danger",
} as const;
const textLink = "font-bold text-kink-gold-bright underline underline-offset-4";
const primaryButton =
  "h-[48px] w-full rounded-[12px] bg-kink-amber text-[16px] font-bold text-black disabled:opacity-50";

/** Settings → Verification. Renders the presenter's view model; decides nothing. */
export default function BronzeVerificationView(p: BronzeVerificationViewProps) {
  const hintId = useId();
  const withdrawButton = useRef<HTMLButtonElement>(null);
  const confirmOpen = p.withdrawConfirm !== null;
  const confirmWasOpen = useRef(false);

  // The withdraw button unmounts while the confirm box is open; when the box
  // closes, focus goes back to it instead of falling to the page.
  useEffect(() => {
    if (confirmOpen) {
      confirmWasOpen.current = true;
      return;
    }
    if (confirmWasOpen.current) {
      confirmWasOpen.current = false;
      withdrawButton.current?.focus();
    }
  }, [confirmOpen]);

  return (
    <div className="flex flex-col gap-[16px] text-app-text">
      <header>
        <h1 className="text-[24px] font-medium text-app-value">{p.title}</h1>
        <p className="mt-[6px] text-[14px] leading-[20px] text-app-subtle">{p.intro}</p>
      </header>

      <section className={card} aria-live="polite">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-app-muted">
          {p.status.heading}
        </h2>
        <p
          className={`mt-[6px] flex items-center gap-[8px] text-[18px] font-bold ${toneClass[p.status.tone]}`}
        >
          {p.status.tone === "good" ? <VerifiedMark size={22} /> : null}
          {p.status.label}
        </p>
        <p className="mt-[4px] text-[14px] leading-[20px] text-app-subtle">{p.status.detail}</p>
        {p.status.failure ? (
          <p className="mt-[6px] text-[14px] leading-[20px] text-app-value">{p.status.failure}</p>
        ) : null}
        {p.attempts ? <p className="mt-[6px] text-[13px] text-app-muted">{p.attempts}</p> : null}
        {p.badgeHint ? (
          <p className="mt-[8px] text-[13px] text-app-subtle">
            {p.badgeHint.text}{" "}
            <Link href={p.badgeHint.href} className={textLink}>
              {p.badgeHint.linkLabel}
            </Link>
          </p>
        ) : null}
        {p.resume ? (
          <button
            type="button"
            disabled={!p.resume.enabled}
            onClick={p.resume.onClick}
            className={`mt-[14px] ${primaryButton}`}
          >
            {p.resume.label}
          </button>
        ) : null}
        {p.refresh ? (
          <button
            type="button"
            onClick={p.refresh.onClick}
            className={`mt-[10px] text-[14px] ${textLink}`}
          >
            {p.refresh.label}
          </button>
        ) : null}
      </section>

      {p.notice ? (
        <p
          role="status"
          className="rounded-[12px] bg-app-input px-[14px] py-[10px] text-[14px] text-app-value"
        >
          {p.notice}
        </p>
      ) : null}

      {p.unavailable ? (
        <p className={`${card} text-[14px] text-app-subtle`}>{p.unavailable}</p>
      ) : null}

      {p.needs ? (
        <section className={card}>
          <h2 className="text-[16px] font-bold text-app-value">{p.needs.heading}</h2>
          <p className="mt-[6px] text-[14px] text-app-subtle">{p.needs.text}</p>
          <ul className="mt-[6px] list-disc pl-[20px] text-[14px] text-app-value">
            {p.needs.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <Link href={p.needs.href} className={`mt-[10px] inline-block text-[14px] ${textLink}`}>
            {p.needs.linkLabel}
          </Link>
        </section>
      ) : null}

      {p.settling ? <p className="text-[14px] text-app-subtle">{p.settling}</p> : null}

      <section className={card}>
        <h2 className="text-[16px] font-bold text-app-value">{p.checks.heading}</h2>
        <ol className="mt-[8px] list-decimal space-y-[6px] pl-[20px] text-[14px] leading-[20px]">
          {p.checks.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <p className="mt-[10px] text-[13px] leading-[19px] text-app-subtle">{p.checks.note}</p>
        <a
          href={p.privacy.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-[10px] inline-block text-[14px] ${textLink}`}
        >
          {p.privacy.label}
        </a>
      </section>

      {p.start?.visible ? (
        <section className={card}>
          {p.consent ? (
            <label className="flex items-start gap-[10px] text-[14px] leading-[20px] text-app-value">
              <input
                type="checkbox"
                checked={p.consent.checked}
                onChange={(e) => p.consent?.onChange(e.target.checked)}
                className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-kink-amber"
              />
              <span>{p.consent.text}</span>
            </label>
          ) : null}
          {p.outdatedPage ? <p className="text-[14px] text-app-danger">{p.outdatedPage}</p> : null}
          <button
            type="button"
            disabled={!p.start.enabled}
            onClick={p.start.onClick}
            aria-describedby={p.start.hint ? hintId : undefined}
            className={`mt-[16px] ${primaryButton}`}
          >
            {p.start.label}
          </button>
          {p.start.hint ? (
            <p id={hintId} className="mt-[8px] text-[13px] leading-[19px] text-app-subtle">
              {p.start.hint}
            </p>
          ) : null}
        </section>
      ) : null}

      {p.actionError ? (
        <p role="alert" className="text-[14px] font-semibold text-app-danger">
          {p.actionError}
        </p>
      ) : null}

      {p.withdrawConfirm ? (
        <section className={`${card} border-app-danger`} aria-label={p.withdrawConfirm.title}>
          <h2 className="text-[16px] font-bold text-app-value">{p.withdrawConfirm.title}</h2>
          <p className="mt-[6px] text-[14px] leading-[20px] text-app-subtle">
            {p.withdrawConfirm.body}
          </p>
          <div className="mt-[14px] flex flex-col-reverse gap-[10px] md:flex-row md:justify-end">
            <button
              type="button"
              onClick={p.withdrawConfirm.onCancel}
              disabled={p.withdrawConfirm.busy}
              autoFocus
              className="h-[44px] rounded-[12px] border border-app-input-border bg-app-input px-[18px] text-[15px] font-bold text-app-value disabled:opacity-50"
            >
              {p.withdrawConfirm.cancelLabel}
            </button>
            <button
              type="button"
              onClick={p.withdrawConfirm.onConfirm}
              disabled={p.withdrawConfirm.busy}
              className="h-[44px] rounded-[12px] bg-app-danger px-[18px] text-[15px] font-bold text-white disabled:opacity-40"
            >
              {p.withdrawConfirm.busy
                ? p.withdrawConfirm.busyLabel
                : p.withdrawConfirm.confirmLabel}
            </button>
          </div>
        </section>
      ) : p.withdraw ? (
        <button
          ref={withdrawButton}
          type="button"
          onClick={p.withdraw.onClick}
          className="self-start text-[14px] font-bold text-app-subtle underline underline-offset-4"
        >
          {p.withdraw.label}
        </button>
      ) : null}
    </div>
  );
}
