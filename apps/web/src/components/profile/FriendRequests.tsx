import Link from "next/link";

export interface FriendRequestsProps {
  copy: {
    title: string;
    intro: string;
    incoming: string;
    outgoing: string;
    loading: string;
    error: string;
    empty: string;
    more: string;
  };
  direction: "incoming" | "outgoing";
  setDirection: (direction: "incoming" | "outgoing") => void;
  items: {
    id: string;
    name: string;
    avatarUrl: string | null;
    href: string | null;
    disabled: boolean;
    primaryLabel: string;
    secondaryLabel: string | null;
    onPrimary: () => void;
    onSecondary: () => void;
  }[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  more: () => void;
  retry: () => void;
}
export default function FriendRequests(p: FriendRequestsProps) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-6 text-app-text">
      <h1 className="text-2xl font-bold text-kink-gold-bright">{p.copy.title}</h1>
      <p className="mt-2 text-sm text-app-subtle">{p.copy.intro}</p>
      <div className="my-5 flex gap-3">
        {(["incoming", "outgoing"] as const).map((direction) => (
          <button
            type="button"
            key={direction}
            onClick={() => p.setDirection(direction)}
            aria-pressed={p.direction === direction}
            className={`min-h-10 rounded-full border border-kink-gold-bright px-5 font-semibold ${p.direction === direction ? "bg-kink-gold-bright text-black" : "text-kink-gold-bright"}`}
          >
            {p.copy[direction]}
          </button>
        ))}
      </div>
      {p.error && (
        <button
          type="button"
          role="alert"
          onClick={p.retry}
          className="my-3 text-sm text-app-danger underline"
        >
          {p.error}
        </button>
      )}
      {!p.loading && !p.items.length && !p.error && (
        <p className="py-8 text-app-subtle">{p.copy.empty}</p>
      )}
      <ul className="space-y-3">
        {p.items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-app-card-border p-4"
          >
            {item.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned member avatar
              <img src={item.avatarUrl} alt="" className="size-12 rounded-full object-cover" />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-12 place-items-center rounded-full bg-app-input"
              >
                👤
              </span>
            )}
            <div className="min-w-0 flex-1 font-semibold">
              {item.href ? <Link href={item.href}>{item.name}</Link> : item.name}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={item.onPrimary}
                disabled={item.disabled}
                className="min-h-10 rounded-lg bg-kink-gold-bright px-3 text-sm font-bold text-black disabled:opacity-50"
              >
                {item.primaryLabel}
              </button>
              {item.secondaryLabel && (
                <button
                  type="button"
                  onClick={item.onSecondary}
                  disabled={item.disabled}
                  className="min-h-10 rounded-lg border border-app-card-border px-3 text-sm disabled:opacity-50"
                >
                  {item.secondaryLabel}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {p.loading && (
        <p role="status" className="py-5 text-sm text-app-subtle">
          {p.copy.loading}
        </p>
      )}
      {p.hasMore && (
        <button
          type="button"
          onClick={p.more}
          disabled={p.loading}
          className="my-5 min-h-10 text-kink-gold-bright underline"
        >
          {p.copy.more}
        </button>
      )}
    </section>
  );
}
