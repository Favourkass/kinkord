import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import SilverCheck from "@/components/app/SilverCheck";
import type { HeldCheckVM } from "@/domain/subscription";

export interface SilverChecksCardProps {
  loading: boolean;
  error: string | null;
  notice: string | null;
  empty: boolean;
  rows: Array<HeldCheckVM & { busy: boolean }>;
  onApprove: (userId: string) => void;
  labels: {
    title: string;
    hint: string;
    loading: string;
    empty: string;
    approve: string;
    approving: string;
  };
}

/** Silver members whose check waits for an admin after a name, username or photo change. */
export default function SilverChecksCard(p: SilverChecksCardProps) {
  const l = p.labels;
  return (
    <section className="rounded-[16px] border border-app-card-border bg-app-card p-[14px]">
      <h2 className="flex items-center gap-[6px] text-[16px] font-bold text-app-value">
        <SilverCheck size={16} />
        {l.title}
        {p.rows.length > 0 ? (
          <span className="font-normal text-app-muted">· {p.rows.length}</span>
        ) : null}
      </h2>
      <p className="pt-[4px] text-[13px] text-app-muted">{l.hint}</p>
      {p.notice ? (
        <p role="status" className="pt-[10px] text-[14px] font-bold text-app-online">
          {p.notice}
        </p>
      ) : null}
      {p.error ? <p className="pt-[10px] text-[14px] text-app-danger">{p.error}</p> : null}
      {p.loading ? <p className="pt-[10px] text-[14px] text-app-muted">{l.loading}</p> : null}
      {p.empty ? <p className="pt-[10px] text-[14px] text-app-subtle">{l.empty}</p> : null}
      {p.rows.length > 0 ? (
        <ul className="mt-[6px] divide-y divide-app-card-border">
          {p.rows.map((r) => (
            <li key={r.userId} className="flex items-center gap-[12px] py-[10px]">
              <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-[10px]">
                <AvatarCircle src={r.avatarUrl} alt={r.name} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-bold text-app-name">
                    {r.name}
                  </span>
                  <span className="block break-words text-[12px] text-app-subtle">
                    {[r.handle, r.change, r.waiting].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => p.onApprove(r.userId)}
                disabled={r.busy}
                className="shrink-0 rounded-[10px] bg-kink-amber px-[14px] py-[8px] text-[13px] font-bold text-black disabled:opacity-60"
              >
                {r.busy ? l.approving : l.approve}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
