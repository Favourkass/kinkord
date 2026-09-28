import type { BlockRuleVM } from "@/domain/moderation";

interface Option<T extends string> {
  value: T;
  label: string;
}

export interface BlocklistFormProps<K extends string, A extends string> {
  kind: K;
  value: string;
  action: A;
  reason: string;
  hint: string;
  error: string | null;
  busy: boolean;
  kinds: readonly Option<K>[];
  actions: readonly Option<A>[];
  setKind: (k: K) => void;
  setValue: (v: string) => void;
  setAction: (a: A) => void;
  setReason: (r: string) => void;
  submit: () => void;
}

export interface BlocklistLabels {
  intro: string;
  kind: string;
  value: string;
  action: string;
  reason: string;
  add: string;
  remove: string;
  empty: string;
}

export interface BlocklistViewProps<K extends string, A extends string> {
  loading: boolean;
  error: string | null;
  rows: BlockRuleVM[];
  empty: boolean;
  removing: string | null;
  remove: (id: string) => void;
  form: BlocklistFormProps<K, A>;
  labels: BlocklistLabels;
}

const field =
  "mt-[6px] h-[46px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[16px] font-normal text-app-value focus:border-kink-amber focus:outline-none";

export default function BlocklistView<K extends string, A extends string>({
  loading,
  error,
  rows,
  empty,
  removing,
  remove,
  form,
  labels,
}: BlocklistViewProps<K, A>) {
  return (
    <div>
      <p className="text-[14px] leading-[20px] text-app-subtle">{labels.intro}</p>

      <form
        className="mt-[16px] grid grid-cols-1 gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[14px] md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          form.submit();
        }}
      >
        <label className="text-[13px] font-bold text-app-text">
          {labels.kind}
          <select
            value={form.kind}
            onChange={(e) => form.setKind(e.target.value as K)}
            className={field}
          >
            {form.kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold text-app-text">
          {labels.action}
          <select
            value={form.action}
            onChange={(e) => form.setAction(e.target.value as A)}
            className={field}
          >
            {form.actions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[13px] font-bold text-app-text md:col-span-2">
          {labels.value}
          <input
            value={form.value}
            onChange={(e) => form.setValue(e.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={field}
          />
          <span className="block pt-[4px] text-[12px] font-normal text-app-muted">{form.hint}</span>
        </label>
        <label className="text-[13px] font-bold text-app-text md:col-span-2">
          {labels.reason}
          <input
            value={form.reason}
            onChange={(e) => form.setReason(e.target.value)}
            maxLength={300}
            className={field}
          />
        </label>
        {form.error ? (
          <p className="text-[14px] text-app-danger md:col-span-2">{form.error}</p>
        ) : null}
        <button
          type="submit"
          disabled={form.busy}
          className="h-[46px] rounded-[12px] bg-kink-amber px-[18px] text-[15px] font-bold text-black disabled:opacity-50 md:col-span-2 md:justify-self-start"
        >
          {form.busy ? "…" : labels.add}
        </button>
      </form>

      {error ? <p className="pt-[16px] text-[14px] text-app-danger">{error}</p> : null}
      {loading ? <p className="pt-[16px] text-[14px] text-app-muted">…</p> : null}
      {empty ? <p className="pt-[16px] text-[14px] text-app-subtle">{labels.empty}</p> : null}

      <ul className="flex flex-col gap-[8px] pt-[16px]">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-[10px] rounded-[14px] border border-app-card-border bg-app-card px-[12px] py-[10px]"
          >
            <div className="min-w-0 flex-1">
              <p className="break-all text-[15px] text-app-value">
                <span className="font-bold">{r.kind}:</span> {r.value}
              </p>
              <p className={`text-[12px] ${r.flagged ? "text-app-subtle" : "text-app-danger"}`}>
                {r.action}
                {r.note ? <span className="text-app-muted"> · {r.note}</span> : null}
              </p>
            </div>
            <button
              type="button"
              onClick={() => remove(r.id)}
              disabled={removing === r.id}
              className="h-[34px] shrink-0 rounded-[10px] px-[10px] text-[14px] font-bold text-app-subtle hover:bg-app-input disabled:opacity-40"
            >
              {labels.remove}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
