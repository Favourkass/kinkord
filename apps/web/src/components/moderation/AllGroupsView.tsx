import Link from "next/link";

export interface AllGroupsViewProps {
  title: string;
  intro: string;
  status: string;
  statuses: { value: string; label: string }[];
  onStatus: (status: "all" | "live" | "archived") => void;
  loading: boolean;
  error: string | null;
  empty: string | null;
  rows: {
    id: string;
    name: string;
    href: string | null;
    meta: string;
    owner: string | null;
    archived: boolean;
    archivedLabel: string | null;
    action: { label: string; onClick: () => void };
  }[];
  previous: (() => void) | null;
  next: (() => void) | null;
  onRetry: () => void;
}

const button =
  "rounded-xl border border-kink-amber px-3 py-2 text-sm font-bold text-kink-amber disabled:opacity-40";

/** Admin → Groups: every group, live and closed down. */
export default function AllGroupsView(p: AllGroupsViewProps) {
  return (
    <section className="pt-6">
      <h2 className="text-xl font-bold text-app-text">{p.title}</h2>
      <p className="mt-2 text-sm text-app-subtle">{p.intro}</p>
      <div className="my-4 flex flex-wrap gap-2">
        {p.statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={p.status === s.value}
            onClick={() => p.onStatus(s.value as "all" | "live" | "archived")}
            className={`rounded-full border px-4 py-1.5 text-sm font-bold ${
              p.status === s.value
                ? "border-kink-amber bg-kink-amber text-black"
                : "border-app-card-border text-app-value"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {p.error ? (
        <div role="alert" className="text-app-danger">
          {p.error}{" "}
          <button className={button} onClick={p.onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {p.empty ? <p className="text-app-subtle">{p.empty}</p> : null}
      <ul className="space-y-3">
        {p.rows.map((row) => (
          <li
            key={row.id}
            className={`flex flex-wrap items-center gap-3 rounded-2xl border border-app-card-border bg-app-card p-4 ${
              row.archived ? "opacity-70" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="font-bold text-kink-amber">
                {row.href ? <Link href={row.href}>{row.name}</Link> : row.name}
                {row.archivedLabel ? (
                  <span className="ml-2 rounded-full bg-app-input px-2 py-0.5 text-xs text-app-subtle">
                    {row.archivedLabel}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-app-subtle">{row.meta}</p>
              {row.owner ? <p className="mt-1 text-xs text-app-subtle">{row.owner}</p> : null}
            </div>
            <button type="button" className={button} onClick={row.action.onClick}>
              {row.action.label}
            </button>
          </li>
        ))}
      </ul>
      {p.loading ? <p className="py-4 text-app-subtle">…</p> : null}
      <div className="mt-4 flex gap-3">
        {p.previous ? (
          <button type="button" className={button} onClick={p.previous}>
            ←
          </button>
        ) : null}
        {p.next ? (
          <button type="button" className={button} onClick={p.next}>
            →
          </button>
        ) : null}
      </div>
    </section>
  );
}
