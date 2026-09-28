import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { AdminMemberRowVM } from "@/domain/moderation";
import Badges from "./Badges";

export interface MemberSearchViewProps {
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  heading: string;
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyLabel: string;
  rows: AdminMemberRowVM[];
}

export default function MemberSearchView({
  query,
  onQuery,
  placeholder,
  heading,
  loading,
  error,
  empty,
  emptyLabel,
  rows,
}: MemberSearchViewProps) {
  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete="off"
        className="h-[48px] w-full rounded-[14px] border border-app-input-border bg-app-input px-[16px] text-[16px] text-app-value placeholder:text-app-muted focus:border-kink-amber focus:outline-none"
      />
      <div className="flex items-center justify-between pt-[20px] pb-[8px]">
        <p className="text-[14px] font-bold text-app-text">{heading}</p>
        {loading ? <span className="text-[13px] text-app-muted">…</span> : null}
      </div>
      {error ? <p className="py-[12px] text-[14px] text-app-danger">{error}</p> : null}
      {empty ? <p className="py-[12px] text-[14px] text-app-subtle">{emptyLabel}</p> : null}
      <ul className="flex flex-col gap-[10px]">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              href={r.href}
              className="flex items-start gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[12px] hover:border-kink-amber"
            >
              <AvatarCircle src={r.avatarUrl} alt={r.title} size={44} />
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="flex flex-wrap items-center gap-[8px]">
                  <span className="truncate text-[16px] font-bold text-app-name">{r.title}</span>
                  <Badges badges={r.badges} />
                </span>
                <span className="text-[14px] text-app-subtle">{r.handle}</span>
                <span className="break-all text-[13px] text-app-muted">{r.email}</span>
                <span className="text-[12px] text-app-muted">{r.meta}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
