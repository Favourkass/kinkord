import type { LocationChecksVM } from "@/presenters/useLocationChecksPresenter";

const card = "rounded-[16px] border border-app-card-border bg-app-card p-[14px]";
const heading = "text-[13px] font-bold uppercase tracking-[0.08em] text-app-muted";

/** Moderation → Location: the switch, the last week in numbers, and every check. */
export default function LocationChecksView(vm: LocationChecksVM) {
  return (
    <div className="flex flex-col gap-[16px]">
      <p className="text-[14px] leading-[20px] text-app-subtle">{vm.intro}</p>
      {vm.error ? <p className="text-[14px] text-app-danger">{vm.error}</p> : null}

      <section className={card} aria-label={vm.mode.title}>
        <p className={heading}>{vm.mode.title}</p>
        {vm.mode.current ? (
          <>
            <p className="pt-[6px] text-[20px] font-bold text-app-text">{vm.mode.current.label}</p>
            <p className="pt-[2px] text-[14px] text-app-subtle">{vm.mode.current.body}</p>
          </>
        ) : (
          <p className="pt-[6px] text-[14px] text-app-muted">…</p>
        )}
        {vm.mode.pending ? (
          <div className="mt-[12px] rounded-[12px] border border-kink-amber/60 p-[12px]">
            <p className="text-[14px] text-app-text">{vm.mode.pending.text}</p>
            {vm.mode.pending.error ? (
              <p className="pt-[6px] text-[14px] text-app-danger">{vm.mode.pending.error}</p>
            ) : null}
            <div className="flex gap-[8px] pt-[10px]">
              <button
                type="button"
                onClick={vm.mode.pending.confirm}
                disabled={vm.mode.pending.busy}
                className="h-[40px] rounded-[10px] bg-kink-amber px-[16px] text-[14px] font-bold text-black disabled:opacity-50"
              >
                {vm.mode.pending.busy ? "…" : vm.mode.pending.confirmLabel}
              </button>
              <button
                type="button"
                onClick={vm.mode.pending.cancel}
                disabled={vm.mode.pending.busy}
                className="h-[40px] rounded-[10px] border border-app-card-border px-[16px] text-[14px] font-semibold text-app-text"
              >
                {vm.mode.pending.cancelLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-[8px] pt-[12px]">
            {vm.mode.options.map((option) => (
              <button
                key={option.mode}
                type="button"
                onClick={option.onSelect}
                className="h-[40px] rounded-[10px] border border-kink-amber px-[14px] text-[14px] font-semibold text-kink-amber hover:bg-kink-amber/10"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {vm.mode.founderOnly ? (
          <p className="pt-[8px] text-[12px] text-app-muted">{vm.mode.founderOnly}</p>
        ) : null}
      </section>

      <section aria-label={vm.window}>
        <p className={heading}>{vm.window}</p>
        <div className="grid grid-cols-1 gap-[10px] pt-[8px] sm:grid-cols-3">
          {vm.stats.map((stat) => (
            <div key={stat.label} className={card}>
              <p className="text-[13px] text-app-muted">{stat.label}</p>
              <p className="pt-[4px] text-[24px] font-bold text-app-text">{stat.value}</p>
              {stat.note ? (
                <p className="pt-[2px] text-[12px] text-app-muted">{stat.note}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-[10px] md:grid-cols-3">
        {[
          { title: vm.decisionsTitle, items: vm.decisions },
          { title: vm.reasonsTitle, items: vm.reasons },
        ].map((block) => (
          <section key={block.title} className={card}>
            <p className={heading}>{block.title}</p>
            <ul className="pt-[8px] text-[14px]">
              {block.items.map((item) => (
                <li key={item.label} className="flex justify-between gap-[8px] py-[2px]">
                  <span className="text-app-text">{item.label}</span>
                  <span className="font-semibold text-app-subtle">{item.count}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className={card}>
          <p className={heading}>{vm.dataTitle}</p>
          <ul className="pt-[8px] text-[13px] text-app-subtle">
            {vm.data.map((line) => (
              <li key={line} className="py-[2px]">
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-label={vm.list.title}>
        <div className="flex flex-wrap items-center justify-between gap-[8px]">
          <p className={heading}>{vm.list.title}</p>
          <select
            value={vm.list.filter.value}
            onChange={(e) => vm.list.filter.onChange(e.target.value)}
            className="h-[40px] rounded-[10px] border border-app-input-border bg-app-input px-[10px] text-[14px] text-app-value"
          >
            {vm.list.filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {vm.list.loading ? (
          <p className="pt-[12px] text-[14px] text-app-muted">{vm.list.loadingLabel}</p>
        ) : null}
        {vm.list.empty ? (
          <p className="pt-[12px] text-[14px] text-app-subtle">{vm.list.empty}</p>
        ) : null}
        <ul className="flex flex-col gap-[8px] pt-[10px]">
          {vm.list.rows.map((row) => (
            <li key={row.id} className={`${card} text-[14px]`}>
              <div className="flex flex-wrap items-center justify-between gap-[6px]">
                <span className="font-semibold text-app-text">{row.title}</span>
                <span className="text-[12px] text-app-muted">{row.when}</span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-[10px] gap-y-[2px] pt-[6px] text-app-subtle">
                <dt className="text-app-muted">{vm.list.columns.chose}</dt>
                <dd>{row.chose}</dd>
                <dt className="text-app-muted">{vm.list.columns.gps}</dt>
                <dd>{row.gps}</dd>
                <dt className="text-app-muted">{vm.list.columns.connection}</dt>
                <dd>
                  {row.connection}
                  {row.anonymizer ? (
                    <span className="ml-[6px] rounded-[6px] bg-kink-amber/15 px-[6px] text-[12px] font-semibold text-kink-amber">
                      {row.anonymizer}
                    </span>
                  ) : null}
                </dd>
                <dt className="text-app-muted">{vm.list.columns.decision}</dt>
                <dd className={row.stopped ? "font-semibold text-app-danger" : "text-app-text"}>
                  {row.decision}
                  {row.watching ? (
                    <span className="ml-[6px] text-[12px] font-normal text-app-muted">
                      ({row.watching})
                    </span>
                  ) : null}
                </dd>
              </dl>
              {row.reasons.length > 0 ? (
                <p className="pt-[6px] text-[12px] text-app-muted">{row.reasons.join(" · ")}</p>
              ) : null}
            </li>
          ))}
        </ul>
        {vm.list.loadMore ? (
          <button
            type="button"
            onClick={vm.list.loadMore.onClick}
            disabled={vm.list.loadMore.busy}
            className="mt-[12px] h-[40px] rounded-[10px] border border-app-card-border px-[16px] text-[14px] font-semibold text-app-text disabled:opacity-50"
          >
            {vm.list.loadMore.busy ? "…" : vm.list.loadMore.label}
          </button>
        ) : null}
      </section>
    </div>
  );
}
