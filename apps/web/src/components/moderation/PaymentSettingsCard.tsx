export interface PaymentSettingsCardProps {
  loading: boolean;
  canEdit: boolean;
  bank: { name: string; accountName: string; accountNumber: string } | null;
  prices: { monthly: string; yearly: string } | null;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  form: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    monthlyNaira: string;
    yearlyNaira: string;
    monthlyUsd: string;
    yearlyUsd: string;
  };
  onField: (field: keyof PaymentSettingsCardProps["form"], value: string) => void;
  saving: boolean;
  onSave: () => void;
  error: string | null;
  notice: string | null;
  labels: {
    title: string;
    empty: string;
    locked: string;
    edit: string;
    save: string;
    saving: string;
    cancel: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    monthly: string;
    yearly: string;
    naira: string;
    usd: string;
  };
}

function Input({
  label,
  value,
  onChange,
  inputMode,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | "decimal" | "text";
  prefix?: string;
}) {
  return (
    <label className="block text-[13px] font-bold text-app-text">
      {label}
      <span className="mt-[6px] flex h-[44px] items-center rounded-[12px] border border-app-input-border bg-app-input px-[10px] focus-within:border-kink-amber">
        {prefix ? <span className="pr-[4px] text-app-muted">{prefix}</span> : null}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          className="w-full bg-transparent text-[15px] font-normal text-app-value outline-none"
        />
      </span>
    </label>
  );
}

/** Where members are told to send money, and what Silver costs. */
export default function PaymentSettingsCard(p: PaymentSettingsCardProps) {
  const l = p.labels;
  return (
    <section className="rounded-[16px] border border-app-card-border bg-app-card p-[14px]">
      <div className="flex items-center justify-between gap-[12px]">
        <h2 className="text-[16px] font-bold text-app-value">{l.title}</h2>
        {p.canEdit && !p.editing && !p.loading ? (
          <button
            type="button"
            onClick={p.onEdit}
            className="rounded-[10px] border border-app-input-border px-[12px] py-[6px] text-[13px] font-bold text-app-value"
          >
            {l.edit}
          </button>
        ) : null}
      </div>

      {p.editing ? (
        <div className="mt-[12px] grid gap-[12px] sm:grid-cols-2">
          <Input
            label={l.bankName}
            value={p.form.bankName}
            onChange={(v) => p.onField("bankName", v)}
          />
          <Input
            label={l.accountName}
            value={p.form.accountName}
            onChange={(v) => p.onField("accountName", v)}
          />
          <Input
            label={l.accountNumber}
            value={p.form.accountNumber}
            onChange={(v) => p.onField("accountNumber", v)}
            inputMode="numeric"
          />
          <span className="hidden sm:block" />
          <Input
            label={`${l.monthly} (${l.naira})`}
            value={p.form.monthlyNaira}
            onChange={(v) => p.onField("monthlyNaira", v)}
            inputMode="decimal"
            prefix={l.naira}
          />
          <Input
            label={`${l.monthly} (${l.usd})`}
            value={p.form.monthlyUsd}
            onChange={(v) => p.onField("monthlyUsd", v)}
            inputMode="decimal"
            prefix={l.usd}
          />
          <Input
            label={`${l.yearly} (${l.naira})`}
            value={p.form.yearlyNaira}
            onChange={(v) => p.onField("yearlyNaira", v)}
            inputMode="decimal"
            prefix={l.naira}
          />
          <Input
            label={`${l.yearly} (${l.usd})`}
            value={p.form.yearlyUsd}
            onChange={(v) => p.onField("yearlyUsd", v)}
            inputMode="decimal"
            prefix={l.usd}
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
        <div className="mt-[8px] text-[14px] text-app-value">
          {p.bank ? (
            <>
              <p className="font-bold">{p.bank.accountName}</p>
              <p>
                {p.bank.name} · <span className="font-mono">{p.bank.accountNumber}</span>
              </p>
            </>
          ) : p.loading ? null : (
            <p className="text-app-danger">{l.empty}</p>
          )}
          {p.prices ? (
            <p className="pt-[6px] text-[13px] text-app-subtle">
              {l.monthly}: {p.prices.monthly} · {l.yearly}: {p.prices.yearly}
            </p>
          ) : null}
          {!p.canEdit && !p.loading ? (
            <p className="pt-[6px] text-[12px] text-app-muted">{l.locked}</p>
          ) : null}
          {p.notice ? (
            <p role="status" className="pt-[6px] text-[13px] font-bold text-app-online">
              {p.notice}
            </p>
          ) : null}
          {p.error ? <p className="pt-[6px] text-[14px] text-app-danger">{p.error}</p> : null}
        </div>
      )}
    </section>
  );
}
