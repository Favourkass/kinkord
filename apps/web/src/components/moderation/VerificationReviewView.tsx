import Link from "next/link";
import type { AdminVerificationReviewVM } from "@/domain/moderation";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";
import ConfirmDialog from "./ConfirmDialog";

export interface VerificationReviewViewProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  rows: AdminVerificationReviewVM[];
  notice: string | null;
  dialog: AdminDialogVM | null;
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
    session: string;
    why: string;
    checksHeading: string;
    passed: string;
    notPassed: string;
    approve: string;
    reject: string;
    cannotApprove: string;
  };
}

/** Identity checks waiting for an admin: both photos, the reasons, the checks, and a decision. */
export default function VerificationReviewView(p: VerificationReviewViewProps) {
  const { labels } = p;
  return (
    <div>
      <p className="text-[14px] leading-[20px] text-app-subtle">{labels.intro}</p>
      <button
        type="button"
        onClick={p.onRefresh}
        className="mt-[10px] text-[13px] font-bold text-app-subtle underline underline-offset-4"
      >
        {labels.refresh}
      </button>

      {p.notice ? (
        <p
          role="status"
          className="mt-[12px] rounded-[12px] bg-app-input px-[14px] py-[10px] text-[14px] text-app-value"
        >
          {p.notice}
        </p>
      ) : null}
      {p.error ? <p className="pt-[16px] text-[14px] text-app-danger">{p.error}</p> : null}
      {p.loading ? <p className="pt-[16px] text-[14px] text-app-muted">{labels.loading}</p> : null}
      {p.empty ? <p className="pt-[16px] text-[14px] text-app-subtle">{labels.empty}</p> : null}

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

            <div className="flex flex-wrap gap-[12px] pt-[12px]">
              {[
                { url: r.photoUrl, label: labels.photo },
                { url: r.originalPhotoUrl, label: labels.original },
              ].map((photo) => (
                <a
                  key={photo.label}
                  href={photo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-[150px] flex-col gap-[4px]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
                  <img
                    src={photo.url}
                    alt={`${photo.label}: ${r.name}`}
                    className="h-[150px] w-[150px] rounded-[10px] bg-app-input object-cover"
                  />
                  <span className="text-[12px] text-app-muted">{photo.label}</span>
                </a>
              ))}
            </div>

            <p className="pt-[12px] text-[12px] font-bold text-app-muted">{labels.why}</p>
            <ul className="list-disc pl-[18px] pt-[4px] text-[14px] text-app-value">
              {r.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>

            <p className="pt-[12px] text-[12px] font-bold text-app-muted">{labels.checksHeading}</p>
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

            {r.canApprove ? null : (
              <p className="pt-[8px] text-[13px] text-app-danger">{labels.cannotApprove}</p>
            )}
            <div className="flex flex-wrap items-center gap-[8px] pt-[14px]">
              <Link
                href={r.memberHref}
                className="rounded-[10px] border border-app-input-border px-[12px] py-[7px] text-[13px] font-bold text-app-value"
              >
                {labels.openMember}
              </Link>
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
            </div>
          </li>
        ))}
      </ul>

      {p.dialog ? <ConfirmDialog dialog={p.dialog} /> : null}
    </div>
  );
}
