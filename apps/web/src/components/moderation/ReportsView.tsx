import Link from "next/link";
import type { AdminReportStatus, AdminReportVM } from "@/domain/moderation";

export interface ReportsViewProps {
  statuses: Array<{ value: AdminReportStatus; label: string; active: boolean }>;
  onStatus: (status: AdminReportStatus) => void;
  loading: boolean;
  error: string | null;
  empty: boolean;
  rows: AdminReportVM[];
  /** The report being closed, if any. */
  busy: string | null;
  onResolve: (id: string) => void;
  onDismiss: (id: string) => void;
  labels: {
    loading: string;
    empty: string;
    reportedBy: string;
    details: string;
    evidence: string;
    noEvidence: string;
    openMember: string;
    resolve: string;
    dismiss: string;
    photo: string;
  };
}

/** Members' reports, each with the chat that came with it and what to do next. */
export default function ReportsView(p: ReportsViewProps) {
  return (
    <div>
      <div className="flex gap-[8px]" role="tablist">
        {p.statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={s.active}
            onClick={() => p.onStatus(s.value)}
            className={`rounded-full px-[14px] py-[6px] text-[13px] font-bold ${
              s.active
                ? "bg-kink-amber text-black"
                : "border border-app-input-border bg-app-input text-app-value"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {p.error ? <p className="pt-[16px] text-[14px] text-app-danger">{p.error}</p> : null}
      {p.loading ? (
        <p className="pt-[16px] text-[14px] text-app-muted">{p.labels.loading}</p>
      ) : null}
      {p.empty ? <p className="pt-[16px] text-[14px] text-app-subtle">{p.labels.empty}</p> : null}

      <ul className="flex flex-col gap-[12px] pt-[16px]">
        {p.rows.map((r) => (
          <li
            key={r.id}
            className="rounded-[16px] border border-app-card-border bg-app-card p-[14px]"
          >
            <div className="flex flex-wrap items-center gap-[8px]">
              <span
                className={`rounded-full px-[10px] py-[3px] text-[12px] font-bold ${
                  r.urgent ? "bg-app-danger-soft text-app-danger" : "bg-app-input text-app-value"
                }`}
              >
                {r.reason}
              </span>
              <span className="text-[12px] text-app-muted">{r.when}</span>
            </div>
            <p className="pt-[10px] text-[16px] font-bold text-app-value">
              {r.reportedName}
              {r.reportedHandle ? (
                <span className="pl-[6px] font-normal text-app-subtle">{r.reportedHandle}</span>
              ) : null}
            </p>
            <p className="text-[13px] text-app-subtle">
              {p.labels.reportedBy} {r.reporter}
            </p>
            {r.details ? (
              <p className="pt-[8px] text-[14px] text-app-value">
                <span className="font-bold">{p.labels.details}:</span> {r.details}
              </p>
            ) : null}

            <p className="pt-[12px] text-[12px] font-bold text-app-muted">{p.labels.evidence}</p>
            {r.evidence.length === 0 ? (
              <p className="pt-[4px] text-[13px] text-app-subtle">{p.labels.noEvidence}</p>
            ) : (
              <ol className="flex flex-col gap-[6px] pt-[6px]">
                {r.evidence.map((e) => (
                  <li
                    key={e.id}
                    className={`rounded-[10px] px-[10px] py-[6px] text-[13px] ${
                      e.fromReported ? "bg-app-danger-soft" : "bg-app-input"
                    }`}
                  >
                    <span className="font-bold text-app-value">{e.who}</span>{" "}
                    <span className="text-[11px] text-app-muted">{e.time}</span>
                    {e.body ? (
                      <p className="whitespace-pre-wrap break-words text-app-value">{e.body}</p>
                    ) : null}
                    {e.photo ? (
                      <a
                        href={e.photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-[4px] block w-fit"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
                        <img
                          src={e.photo.thumbUrl}
                          alt={p.labels.photo}
                          className="h-[120px] w-auto rounded-[8px] object-cover"
                        />
                      </a>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-wrap items-center gap-[8px] pt-[14px]">
              <Link
                href={r.reportedHref}
                className="rounded-[10px] border border-app-input-border px-[12px] py-[7px] text-[13px] font-bold text-app-value"
              >
                {p.labels.openMember}
              </Link>
              {r.open ? (
                <>
                  <button
                    type="button"
                    onClick={() => p.onResolve(r.id)}
                    disabled={p.busy === r.id}
                    className="rounded-[10px] bg-kink-amber px-[12px] py-[7px] text-[13px] font-bold text-black disabled:opacity-50"
                  >
                    {p.labels.resolve}
                  </button>
                  <button
                    type="button"
                    onClick={() => p.onDismiss(r.id)}
                    disabled={p.busy === r.id}
                    className="rounded-[10px] px-[12px] py-[7px] text-[13px] font-bold text-app-subtle hover:bg-app-input disabled:opacity-50"
                  >
                    {p.labels.dismiss}
                  </button>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
