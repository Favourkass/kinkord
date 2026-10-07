import Link from "next/link";
import type { AdminPaymentVM, PaymentStatus } from "@/domain/subscription";

export interface PaymentsViewProps {
  statuses: Array<{ value: PaymentStatus; label: string; active: boolean }>;
  onStatus: (status: PaymentStatus) => void;
  query: string;
  onQuery: (q: string) => void;
  loading: boolean;
  error: string | null;
  notice: string | null;
  empty: boolean;
  rows: AdminPaymentVM[];
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  labels: {
    search: string;
    loading: string;
    empty: string;
    expected: string;
    paid: string;
    amountDiffers: string;
    reference: string;
    theirReference: string;
    from: string;
    member: string;
    receipt: string;
    noReceipt: string;
    openReceipt: string;
    reviewNote: string;
    verify: string;
    reject: string;
  };
}

/**
 * Silver payments for the admins. Each is headed by the name on the account
 * that sent it, which is what the bank statement shows, so a transfer can be
 * matched to its proof at a glance.
 */
export default function PaymentsView(p: PaymentsViewProps) {
  return (
    <div>
      <div className="flex flex-wrap gap-[8px]" role="tablist">
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
      <input
        type="search"
        value={p.query}
        onChange={(e) => p.onQuery(e.target.value)}
        placeholder={p.labels.search}
        aria-label={p.labels.search}
        className="mt-[12px] h-[44px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[15px] text-app-value focus:border-kink-amber focus:outline-none"
      />
      {p.notice ? (
        <p role="status" className="pt-[12px] text-[14px] font-bold text-app-online">
          {p.notice}
        </p>
      ) : null}
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
            <div className="flex gap-[14px]">
              {r.receiptUrl ? (
                <a
                  href={r.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={p.labels.openReceipt}
                  className="block shrink-0"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable */}
                  <img
                    src={r.receiptUrl}
                    alt={p.labels.receipt}
                    className="h-[120px] w-[80px] rounded-[10px] border border-app-card-border object-cover object-top"
                  />
                </a>
              ) : (
                <span className="grid h-[120px] w-[80px] shrink-0 place-items-center rounded-[10px] border border-dashed border-app-card-border px-[6px] text-center text-[11px] text-app-muted">
                  {p.labels.noReceipt}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="break-words text-[17px] font-bold text-app-value">{r.sender}</p>
                {r.senderBank || r.senderNumber ? (
                  <p className="text-[13px] text-app-subtle">
                    {p.labels.from} {[r.senderBank, r.senderNumber].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                <p className="pt-[6px] text-[13px] text-app-subtle">
                  {p.labels.member}:{" "}
                  {r.memberHref ? (
                    <Link href={r.memberHref} className="font-bold text-app-value underline">
                      {r.member}
                    </Link>
                  ) : (
                    r.member
                  )}
                </p>
                <p className="text-[13px] text-app-subtle">
                  {r.plan} · {r.when}
                </p>
              </div>
            </div>

            <dl className="mt-[12px] grid grid-cols-[auto_1fr] gap-x-[12px] gap-y-[4px] text-[14px]">
              <dt className="text-app-muted">{p.labels.expected}</dt>
              <dd className="font-bold text-app-value">{r.expected}</dd>
              {r.paid ? (
                <>
                  <dt className="text-app-muted">{p.labels.paid}</dt>
                  <dd
                    className={`font-bold ${r.amountMatches ? "text-app-value" : "text-app-danger"}`}
                  >
                    {r.paid}
                    {r.amountMatches ? null : (
                      <span className="block text-[12px] font-normal">
                        {p.labels.amountDiffers}
                      </span>
                    )}
                  </dd>
                </>
              ) : null}
              <dt className="text-app-muted">{p.labels.reference}</dt>
              <dd className="break-all font-mono text-app-value">{r.reference}</dd>
              {r.paidReference ? (
                <>
                  <dt className="text-app-muted">{p.labels.theirReference}</dt>
                  <dd className="break-all font-mono text-app-value">{r.paidReference}</dd>
                </>
              ) : null}
            </dl>

            {r.reviewNote ? (
              <p className="mt-[10px] rounded-[10px] bg-app-danger-soft px-[10px] py-[6px] text-[13px] text-app-value">
                <span className="font-bold">{p.labels.reviewNote}:</span> {r.reviewNote}
              </p>
            ) : null}

            {r.canVerify || r.canReject ? (
              <div className="flex flex-wrap items-center gap-[8px] pt-[14px]">
                {r.canVerify ? (
                  <button
                    type="button"
                    onClick={() => p.onVerify(r.id)}
                    className="rounded-[10px] bg-kink-amber px-[14px] py-[8px] text-[13px] font-bold text-black"
                  >
                    {p.labels.verify}
                  </button>
                ) : null}
                {r.canReject ? (
                  <button
                    type="button"
                    onClick={() => p.onReject(r.id)}
                    className="rounded-[10px] px-[12px] py-[8px] text-[13px] font-bold text-app-danger hover:bg-app-input"
                  >
                    {p.labels.reject}
                  </button>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
