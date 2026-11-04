import Link from "next/link";
import type { SilverMembersViewVM } from "@/presenters/useSilverMembersPresenter";

const tone = {
  subscription: "text-app-online",
  ring: "text-kink-amber",
  both: "text-kink-amber",
  given: "text-app-value",
  other: "text-app-muted",
} as const;

/** Everyone on Silver now: a numbered list, each with how they got it and when it runs out. */
export default function SilverMembersView(p: SilverMembersViewVM) {
  return (
    <section aria-label={p.title}>
      <h2 className="pb-[10px] text-[16px] font-bold text-app-value">{p.title}</h2>
      <div className="flex flex-wrap gap-[8px]" role="tablist">
        {p.filters.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={f.active}
            onClick={() => p.onFilter(f.value)}
            className={`rounded-full px-[14px] py-[6px] text-[13px] font-bold ${
              f.active
                ? "bg-kink-amber text-black"
                : "border border-app-input-border bg-app-input text-app-value"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <input
        type="search"
        value={p.query}
        onChange={(e) => p.onQuery(e.target.value)}
        placeholder={p.searchLabel}
        aria-label={p.searchLabel}
        className="mt-[12px] h-[44px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[15px] text-app-value focus:border-kink-amber focus:outline-none"
      />
      {p.error ? <p className="pt-[16px] text-[14px] text-app-danger">{p.error}</p> : null}
      {p.loading ? <p className="pt-[16px] text-[14px] text-app-muted">{p.loading}</p> : null}
      {p.empty ? <p className="pt-[16px] text-[14px] text-app-subtle">{p.empty}</p> : null}
      {p.members.length ? (
        <ol className="mt-[12px] flex flex-col divide-y divide-app-card-border rounded-[14px] border border-app-card-border bg-app-card">
          {p.members.map((m, i) => (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline gap-x-[10px] px-[12px] py-[10px]"
            >
              <span className="w-[28px] shrink-0 text-[13px] text-app-muted">{i + 1}.</span>
              <Link
                href={m.href}
                className="text-[14px] font-bold text-app-value underline-offset-2 hover:underline"
              >
                {m.name}
              </Link>
              <span className={`text-[13px] font-semibold ${tone[m.source]}`}>{m.sourceLabel}</span>
              <span className="text-[13px] text-app-subtle">{m.detail}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {p.moreLabel ? (
        <button
          type="button"
          onClick={p.onMore}
          className="mt-[12px] rounded-[10px] border border-app-input-border px-[14px] py-[8px] text-[13px] font-bold text-app-value"
        >
          {p.moreLabel}
        </button>
      ) : null}
    </section>
  );
}
