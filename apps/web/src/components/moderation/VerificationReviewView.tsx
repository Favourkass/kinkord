"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import MaskIcon from "@/components/app/MaskIcon";
import type { AdminVerificationReviewVM } from "@/domain/moderation";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";
import ConfirmDialog from "./ConfirmDialog";

export interface VerificationStepUpVM {
  title: string;
  body: string;
  label: string;
  action: string;
  code: string;
  setCode: (value: string) => void;
  submit: () => void;
  canSubmit: boolean;
  busy: boolean;
  /** A refused code, a lock, two-factor being off, or the confirmation running out. */
  error: string | null;
  /** For admins without two-factor yet: where to turn it on. */
  hint: string;
  security: { label: string; href: string };
}

export interface VerificationReviewViewProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  rows: AdminVerificationReviewVM[];
  notice: string | null;
  dialog: AdminDialogVM | null;
  stepUp: VerificationStepUpVM | null;
  /** "Confirmed until 14:35", while this session's confirmation lasts. */
  confirmedUntil: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRefresh: () => void;
  labels: {
    intro: string;
    loading: string;
    empty: string;
    refresh: string;
    openMember: string;
    photo: string;
    original: string;
    closePhoto: string;
    session: string;
    why: string;
    checksHeading: string;
    passed: string;
    notPassed: string;
    approve: string;
    reject: string;
  };
}

interface ReviewPhotoProps {
  url: string;
  label: string;
  alt: string;
  closeLabel: string;
}

/**
 * A review photo that enlarges in the page. Opening its signed link in a new tab
 * would leave that link in the browser's history.
 */
function ReviewPhoto({ url, label, alt, closeLabel }: ReviewPhotoProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Close is the viewer's only control, so focus stays on it; Esc closes, and focus
  // returns to the photo.
  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-[150px] cursor-zoom-in flex-col gap-[4px] text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-[150px] w-[150px] rounded-[10px] bg-app-input object-cover"
        />
        <span aria-hidden="true" className="text-[12px] text-app-muted">
          {label}
        </span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-[16px]"
        >
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label={closeLabel}
            className="absolute right-[16px] top-[16px] text-white"
          >
            <MaskIcon src="/app/feed/icon-close.svg" width={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
          <img
            src={url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-[10px] object-contain"
          />
        </div>
      ) : null}
    </>
  );
}

/** Identity checks waiting for an admin: both photos, the reasons, the checks, and a decision. */
export default function VerificationReviewView(p: VerificationReviewViewProps) {
  const { labels } = p;
  return (
    <div>
      <p className="text-[14px] leading-[20px] text-app-subtle">{labels.intro}</p>
      {!p.stepUp ? (
        <div className="mt-[10px] flex flex-wrap items-baseline gap-x-[12px] gap-y-[4px]">
          <button
            type="button"
            onClick={p.onRefresh}
            className="text-[13px] font-bold text-app-subtle underline underline-offset-4"
          >
            {labels.refresh}
          </button>
          {p.confirmedUntil ? (
            <span className="text-[13px] text-app-muted">{p.confirmedUntil}</span>
          ) : null}
        </div>
      ) : null}

      {p.stepUp ? (
        <form
          className="mt-[16px] rounded-[16px] border border-app-card-border bg-app-card p-[14px]"
          onSubmit={(event) => {
            event.preventDefault();
            p.stepUp?.submit();
          }}
        >
          <h2 className="text-[16px] font-bold text-app-value">{p.stepUp.title}</h2>
          <p className="pt-[4px] text-[14px] leading-[20px] text-app-subtle">{p.stepUp.body}</p>
          <label className="block pt-[12px] text-[13px] font-bold text-app-text">
            {p.stepUp.label}
            {/* No maxLength: the presenter keeps six digits, after dropping spaces from a paste. */}
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={p.stepUp.code}
              onChange={(event) => p.stepUp?.setCode(event.target.value)}
              className="mt-[6px] h-[44px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[10px] font-mono text-[16px] tracking-[0.2em] text-app-value focus:border-kink-amber focus:outline-none"
            />
          </label>
          {p.stepUp.error ? (
            <p role="alert" className="pt-[8px] text-[14px] text-app-danger">
              {p.stepUp.error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!p.stepUp.canSubmit}
            className="mt-[12px] h-[44px] rounded-[12px] bg-kink-amber px-[16px] text-[14px] font-bold text-black disabled:opacity-40"
          >
            {p.stepUp.action}
          </button>
          <p className="pt-[12px] text-[13px] text-app-subtle">
            {p.stepUp.hint}{" "}
            <Link
              href={p.stepUp.security.href}
              className="font-bold text-app-value underline underline-offset-4"
            >
              {p.stepUp.security.label}
            </Link>
          </p>
        </form>
      ) : null}

      {!p.stepUp && p.notice ? (
        <p
          role="status"
          className="mt-[12px] rounded-[12px] bg-app-input px-[14px] py-[10px] text-[14px] text-app-value"
        >
          {p.notice}
        </p>
      ) : null}
      {!p.stepUp && p.error ? (
        <p role="alert" className="pt-[16px] text-[14px] text-app-danger">
          {p.error}
        </p>
      ) : null}
      {!p.stepUp && p.loading ? (
        <p className="pt-[16px] text-[14px] text-app-muted">{labels.loading}</p>
      ) : null}
      {!p.stepUp && p.empty ? (
        <p className="pt-[16px] text-[14px] text-app-subtle">{labels.empty}</p>
      ) : null}

      {/* Out of the page while a new code is needed: its photo links lapse with the session. */}
      {p.stepUp ? null : (
        <ul className="flex flex-col gap-[12px] pt-[16px]">
          {p.rows.map((r) => (
            <li
              key={r.id}
              className="rounded-[16px] border border-app-card-border bg-app-card p-[14px]"
            >
              <div className="flex flex-wrap items-baseline gap-x-[8px]">
                <p className="text-[16px] font-bold text-app-value">{r.name}</p>
                {r.handle ? <p className="text-[14px] text-app-subtle">{r.handle}</p> : null}
                <p className="text-[12px] text-app-muted">{r.when}</p>
              </div>
              {r.duplicate ? (
                <Link
                  href={r.duplicate.href}
                  className="mt-[8px] inline-block rounded-[10px] bg-app-danger-soft px-[10px] py-[4px] text-[13px] font-bold text-app-danger underline-offset-4 hover:underline"
                >
                  {r.duplicate.label}
                </Link>
              ) : null}

              <div className="flex flex-wrap gap-[12px] pt-[12px]">
                {[
                  { url: r.photoUrl, label: labels.photo },
                  { url: r.originalPhotoUrl, label: labels.original },
                ].map((photo) => (
                  <ReviewPhoto
                    key={photo.label}
                    url={photo.url}
                    label={photo.label}
                    alt={`${photo.label}: ${r.name}`}
                    closeLabel={labels.closePhoto}
                  />
                ))}
              </div>

              <p className="pt-[12px] text-[12px] font-bold text-app-muted">{labels.why}</p>
              <ul className="list-disc pl-[18px] pt-[4px] text-[14px] text-app-value">
                {r.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>

              <p className="pt-[12px] text-[12px] font-bold text-app-muted">
                {labels.checksHeading}
              </p>
              <ul className="grid grid-cols-1 gap-x-[16px] gap-y-[2px] pt-[4px] text-[13px] md:grid-cols-2">
                {r.checks.map((c) => (
                  <li key={c.key} className="flex items-center gap-[6px]">
                    <span
                      aria-hidden="true"
                      className={c.passed ? "text-kink-gold-bright" : "text-app-danger"}
                    >
                      {c.passed ? "✓" : "✕"}
                    </span>
                    <span className="text-app-value">{c.label}</span>
                    <span className="sr-only">{c.passed ? labels.passed : labels.notPassed}</span>
                  </li>
                ))}
              </ul>

              <p className="break-all pt-[12px] text-[13px] text-app-subtle">
                {labels.session}: <span className="font-mono text-app-value">{r.sessionId}</span>
              </p>

              {r.locked ? (
                <p className="pt-[8px] text-[13px] text-app-subtle">{r.locked}</p>
              ) : r.cannotApprove ? (
                <p className="pt-[8px] text-[13px] text-app-danger">{r.cannotApprove}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-[8px] pt-[14px]">
                <Link
                  href={r.memberHref}
                  className="rounded-[10px] border border-app-input-border px-[12px] py-[7px] text-[13px] font-bold text-app-value"
                >
                  {labels.openMember}
                </Link>
                {r.locked ? null : (
                  <>
                    <button
                      type="button"
                      onClick={() => p.onApprove(r.id)}
                      disabled={!r.canApprove}
                      className="rounded-[10px] bg-kink-amber px-[12px] py-[7px] text-[13px] font-bold text-black disabled:opacity-40"
                    >
                      {labels.approve}
                    </button>
                    <button
                      type="button"
                      onClick={() => p.onReject(r.id)}
                      className="rounded-[10px] border border-app-danger px-[12px] py-[7px] text-[13px] font-bold text-app-danger"
                    >
                      {labels.reject}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {p.dialog ? <ConfirmDialog dialog={p.dialog} /> : null}
    </div>
  );
}
