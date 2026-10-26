import Link from "next/link";

export interface NotificationSettingsProps {
  title: string;
  backLabel: string;
  backHref: string;
  description: string;
  rhythm: string;
  loadingLabel: string;
  retryLabel: string;
  loading: boolean;
  error: string | null;
  notice: string | null;
  onRetry: () => void;
  rows: {
    key: string;
    label: string;
    hint: string | null;
    on: boolean;
    busy: boolean;
    disabled: boolean;
    onToggle: () => void;
  }[];
}

export default function NotificationSettings(p: NotificationSettingsProps) {
  return (
    <section className="mx-auto w-full max-w-[640px] px-5 pb-10 text-white">
      <Link href={p.backHref} className="mb-5 inline-block text-sm text-kink-gold-bright">
        {p.backLabel}
      </Link>
      <h1 className="text-2xl font-bold text-kink-gold-bright">{p.title}</h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-white/65">{p.description}</p>
      {p.error ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-400/40 p-4 text-sm">
          {p.error}
          <button
            type="button"
            onClick={p.onRetry}
            className="ml-3 text-kink-gold-bright underline"
          >
            {p.retryLabel}
          </button>
        </div>
      ) : null}
      {p.notice ? (
        <p role="status" className="mb-3 text-sm text-kink-gold-bright">
          {p.notice}
        </p>
      ) : null}
      {p.loading ? (
        <p role="status">{p.loadingLabel}</p>
      ) : (
        <ul className="divide-y divide-white/10 overflow-hidden rounded-2xl border border-kink-gold-bright/25 bg-[#0c0c0c]">
          {p.rows.map((row) => (
            <li key={row.key} className="flex min-h-16 items-center gap-4 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-5">{row.label}</span>
                {row.hint ? (
                  <span className="mt-1 block text-xs leading-5 text-white/60">{row.hint}</span>
                ) : null}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={row.on}
                aria-label={row.label}
                disabled={row.disabled}
                onClick={row.onToggle}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
                  row.on ? "bg-kink-gold-bright" : "bg-white/20"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-1 size-5 rounded-full bg-black transition-all ${
                    row.on ? "left-6" : "left-1"
                  } ${row.busy ? "animate-pulse" : ""}`}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs leading-5 text-white/60">{p.rhythm}</p>
    </section>
  );
}
