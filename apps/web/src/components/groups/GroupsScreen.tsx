import Link from "next/link";
import { ChevronRight, Lock, Search } from "lucide-react";
import GroupTile from "./GroupTile";

export interface GroupRowProps {
  slug: string;
  href: string;
  name: string;
  description: string;
  meta: string;
  privacy: string;
  closed: boolean;
  badge: string | null;
}

interface Chip {
  key: string;
  label: string;
  active: boolean;
  onSelect: () => void;
}

export interface GroupsScreenProps {
  title: string;
  intro: string;
  search: { value: string; placeholder: string; onChange: (value: string) => void };
  views: Chip[];
  categories: Chip[];
  rows: GroupRowProps[];
  loading: boolean;
  loadingText: string;
  error: string | null;
  retryLabel: string;
  retry: () => void;
  empty: string | null;
  loadMore: { label: string; busy: boolean; onClick: () => void } | null;
  create: { label: string; href: string } | null;
}

function GroupRow(row: GroupRowProps) {
  return (
    <li>
      <Link
        href={row.href}
        className="flex items-start gap-3 rounded-2xl border border-app-card-border bg-app-card p-4 hover:border-kink-gold-bright/60"
      >
        <GroupTile />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-bold text-app-text">{row.name}</span>
            {row.closed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-app-input px-2 py-0.5 text-[11px] font-semibold text-app-subtle">
                <Lock size={11} aria-hidden="true" />
                {row.privacy}
              </span>
            ) : null}
            {row.badge ? (
              <span className="rounded-full bg-kink-gold-bright/15 px-2 py-0.5 text-[11px] font-bold text-kink-gold-bright">
                {row.badge}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[12px] text-app-subtle">{row.meta}</span>
          <span className="mt-1.5 line-clamp-2 block text-[13px] text-app-value">
            {row.description}
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="mt-3 shrink-0 text-app-muted" />
      </Link>
    </li>
  );
}

function Chips({ items, label }: { items: Chip[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {items.map((chip) => (
        <button
          key={chip.key}
          type="button"
          aria-pressed={chip.active}
          onClick={chip.onSelect}
          className={`shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-semibold ${
            chip.active
              ? "border-kink-gold-bright bg-kink-gold-bright text-black"
              : "border-app-card-border text-app-value"
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

/** The Groups directory: your groups, near you, popular and new, with search and categories. */
export default function GroupsScreen(p: GroupsScreenProps) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6 text-app-text">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-kink-gold-bright">{p.title}</h1>
          <p className="mt-1 text-sm text-app-subtle">{p.intro}</p>
        </div>
        {p.create ? (
          <Link
            href={p.create.href}
            className="shrink-0 rounded-xl bg-kink-gold-bright px-4 py-2.5 text-sm font-bold text-black"
          >
            {p.create.label}
          </Link>
        ) : null}
      </div>

      <label className="mt-5 flex items-center gap-2 rounded-xl border border-app-card-border bg-app-input px-3">
        <Search aria-hidden="true" size={17} className="text-app-muted" />
        <input
          type="search"
          value={p.search.value}
          onChange={(e) => p.search.onChange(e.target.value)}
          placeholder={p.search.placeholder}
          aria-label={p.search.placeholder}
          className="min-h-11 w-full bg-transparent text-sm text-app-text outline-none placeholder:text-app-muted"
        />
      </label>

      <div className="mt-4 space-y-3">
        <Chips items={p.views} label={p.title} />
        <Chips items={p.categories} label="Categories" />
      </div>

      {p.error ? (
        <p role="alert" className="mt-5 text-sm text-app-danger">
          {p.error}{" "}
          <button type="button" onClick={p.retry} className="underline">
            {p.retryLabel}
          </button>
        </p>
      ) : null}
      {p.empty ? <p className="py-10 text-center text-sm text-app-subtle">{p.empty}</p> : null}

      <ul className="mt-5 space-y-3">
        {p.rows.map((row) => (
          <GroupRow key={row.slug} {...row} />
        ))}
      </ul>

      {p.loading ? (
        <p role="status" className="py-5 text-sm text-app-subtle">
          {p.loadingText}
        </p>
      ) : null}
      {p.loadMore ? (
        <button
          type="button"
          onClick={p.loadMore.onClick}
          disabled={p.loadMore.busy}
          className="my-5 min-h-10 text-sm font-semibold text-kink-gold-bright underline disabled:opacity-50"
        >
          {p.loadMore.label}
        </button>
      ) : null}
    </section>
  );
}
