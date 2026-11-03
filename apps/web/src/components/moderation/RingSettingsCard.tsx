import type { RingSettingsCardVM } from "@/presenters/useRingSettingsPresenter";

function CountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-[13px] font-bold text-app-text">
      {label}
      <span className="mt-[6px] flex h-[44px] items-center rounded-[12px] border border-app-input-border bg-app-input px-[10px] focus-within:border-kink-amber">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
          className="w-full bg-transparent text-[15px] font-normal text-app-value outline-none"
        />
      </span>
    </label>
  );
}

/** How many Kink Rings each Silver plan brings, and the founders' form to change it. */
export default function RingSettingsCard(p: RingSettingsCardVM) {
  const l = p.labels;
  return (
    <section className="rounded-[16px] border border-app-card-border bg-app-card p-[14px]">
      <div className="flex items-center justify-between gap-[12px]">
        <h2 className="text-[16px] font-bold text-app-value">{p.title}</h2>
        {p.canEdit ? (
          <button
            type="button"
            onClick={p.onEdit}
            className="rounded-[10px] border border-app-input-border px-[12px] py-[6px] text-[13px] font-bold text-app-value"
          >
            {l.edit}
          </button>
        ) : null}
      </div>
      <p className="pt-[6px] text-[13px] text-app-subtle">{p.hint}</p>
      {p.loading ? <p className="pt-[12px] text-[14px] text-app-muted">{p.loading}</p> : null}

      {p.editing ? (
        <div className="mt-[12px] grid gap-[12px] sm:grid-cols-2">
          <CountInput
            label={l.monthly}
            value={p.form.monthly}
            onChange={(v) => p.onField("monthly", v)}
          />
          <CountInput
            label={l.yearly}
            value={p.form.yearly}
            onChange={(v) => p.onField("yearly", v)}
          />
          {p.error ? <p className="text-[14px] text-app-danger sm:col-span-2">{p.error}</p> : null}
          <div className="flex gap-[8px] sm:col-span-2">
            <button
              type="button"
              onClick={p.onSave}
              disabled={p.saving}
              className="rounded-[10px] bg-kink-amber px-[14px] py-[8px] text-[13px] font-bold text-black disabled:opacity-50"
            >
              {p.saving ? l.saving : l.save}
            </button>
            <button
              type="button"
              onClick={p.onCancel}
              disabled={p.saving}
              className="rounded-[10px] px-[12px] py-[8px] text-[13px] font-bold text-app-subtle hover:bg-app-input"
            >
              {l.cancel}
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-[12px] grid gap-[8px] sm:grid-cols-2">
          {p.plans.map((plan) => (
            <div key={plan.key} className="rounded-[12px] bg-app-input px-[12px] py-[10px]">
              <dt className="text-[13px] text-app-subtle">{plan.label}</dt>
              <dd className="text-[16px] font-bold text-app-value">{plan.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {!p.editing && p.error ? (
        <p className="pt-[10px] text-[14px] text-app-danger">{p.error}</p>
      ) : null}
      {p.notice ? (
        <p role="status" className="pt-[10px] text-[13px] text-kink-amber">
          {p.notice}
        </p>
      ) : null}
      {p.locked ? <p className="pt-[10px] text-[13px] text-app-muted">{p.locked}</p> : null}
    </section>
  );
}
