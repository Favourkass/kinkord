import Link from "next/link";

interface Option {
  value: string;
  label: string;
}

interface TextField {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  disabled?: boolean;
  note?: string | null;
}

interface SelectField {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}

export interface GroupFormProps {
  title: string;
  loading: boolean;
  loadError: string | null;
  blocked: { message: string; action: { label: string; href: string } | null } | null;
  name: TextField;
  description: TextField;
  rules: TextField;
  category: SelectField;
  privacy: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    locked: string | null;
    options: (Option & { hint: string })[];
  };
  location: { label: string; country: SelectField; state: SelectField | null };
  submit: { label: string; busy: boolean; onClick: () => void };
  cancel: { label: string; href: string };
  error: string | null;
}

const input =
  "mt-1 w-full rounded-xl border border-app-card-border bg-app-input px-3 text-sm text-app-text outline-none focus:border-kink-gold-bright disabled:opacity-60";
const label = "block text-xs font-semibold text-app-subtle";

function Select({ field }: { field: SelectField }) {
  return (
    <label className={label}>
      {field.label}
      <select
        value={field.value}
        onChange={(e) => field.onChange(e.target.value)}
        className={`${input} min-h-11`}
      >
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldError({ text }: { text: string | null }) {
  return text ? (
    <span className="mt-1 block text-xs font-normal text-app-danger">{text}</span>
  ) : null;
}

/** Create a group, or edit one. */
export default function GroupForm(p: GroupFormProps) {
  return (
    <section className="mx-auto w-full max-w-xl px-4 py-6 text-app-text">
      <h1 className="text-2xl font-bold text-kink-gold-bright">{p.title}</h1>
      {p.loading ? <p className="mt-6 text-sm text-app-subtle">…</p> : null}
      {p.loadError ? <p className="mt-6 text-sm text-app-subtle">{p.loadError}</p> : null}
      {p.blocked ? (
        <div className="mt-6 rounded-2xl border border-app-card-border bg-app-card p-4">
          <p className="text-sm text-app-value">{p.blocked.message}</p>
          {p.blocked.action ? (
            <Link
              href={p.blocked.action.href}
              className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-kink-gold-bright px-4 text-sm font-bold text-black"
            >
              {p.blocked.action.label}
            </Link>
          ) : null}
        </div>
      ) : null}
      {!p.loading && !p.loadError && !p.blocked ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.submit.onClick();
          }}
          className="mt-5 space-y-4"
        >
          <label className={label}>
            {p.name.label}
            <input
              value={p.name.value}
              onChange={(e) => p.name.onChange(e.target.value)}
              placeholder={p.name.placeholder}
              disabled={p.name.disabled}
              maxLength={60}
              className={`${input} min-h-11`}
            />
            {p.name.note ? (
              <span className="mt-1 block font-normal text-app-muted">{p.name.note}</span>
            ) : null}
            <FieldError text={p.name.error} />
          </label>
          <Select field={p.category} />
          <fieldset>
            <legend className={label}>{p.privacy.label}</legend>
            {p.privacy.locked ? (
              <p className="mt-1 text-sm text-app-value">
                {p.privacy.options.find((o) => o.value === p.privacy.value)?.label} ·{" "}
                <span className="text-app-subtle">{p.privacy.locked}</span>
              </p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {p.privacy.options.map((o) => (
                  <label
                    key={o.value}
                    className={`cursor-pointer rounded-xl border p-3 text-sm ${
                      p.privacy.value === o.value
                        ? "border-kink-gold-bright bg-kink-gold-bright/10"
                        : "border-app-card-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="group-privacy"
                      value={o.value}
                      checked={p.privacy.value === o.value}
                      onChange={() => p.privacy.onChange(o.value)}
                      className="sr-only"
                    />
                    <span className="block font-bold text-app-text">{o.label}</span>
                    <span className="mt-1 block text-xs text-app-subtle">{o.hint}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <label className={label}>
            {p.description.label}
            <textarea
              value={p.description.value}
              onChange={(e) => p.description.onChange(e.target.value)}
              placeholder={p.description.placeholder}
              rows={4}
              className={`${input} py-3`}
            />
            <FieldError text={p.description.error} />
          </label>
          <label className={label}>
            {p.rules.label}
            <textarea
              value={p.rules.value}
              onChange={(e) => p.rules.onChange(e.target.value)}
              placeholder={p.rules.placeholder}
              rows={4}
              className={`${input} py-3`}
            />
            <FieldError text={p.rules.error} />
          </label>
          <fieldset className="space-y-2">
            <legend className={label}>{p.location.label}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select field={p.location.country} />
              {p.location.state ? <Select field={p.location.state} /> : null}
            </div>
          </fieldset>
          {p.error ? (
            <p role="alert" className="text-sm text-app-danger">
              {p.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Link
              href={p.cancel.href}
              className="inline-flex min-h-11 items-center rounded-xl border border-app-card-border px-4 text-sm text-app-value"
            >
              {p.cancel.label}
            </Link>
            <button
              type="submit"
              disabled={p.submit.busy}
              className="min-h-11 flex-1 rounded-xl bg-kink-gold-bright px-4 text-sm font-bold text-black disabled:opacity-50"
            >
              {p.submit.label}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
