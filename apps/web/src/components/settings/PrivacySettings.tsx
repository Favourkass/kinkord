import Link from "next/link";
import { useId } from "react";
interface PrivacySettingsProps {
  title: string;
  backHref: string;
  description: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  notice: string | null;
  onRetry: () => void;
  fields: {
    key: string;
    icon: string;
    label: string;
    hint: string | null;
    unavailable: boolean;
    audienceLabel: string;
    expanded: boolean;
    onToggle: () => void;
    options: { value: string; label: string; selected: boolean; onSelect: () => void }[];
  }[];
}
export default function PrivacySettings(props: PrivacySettingsProps) {
  const instanceId = useId();
  return (
    <section className="mx-auto w-full max-w-[640px] px-5 pb-10 text-white">
      <Link href={props.backHref} className="mb-5 inline-block text-sm text-kink-gold-bright">
        ← Privacy
      </Link>
      <h1 className="text-2xl font-bold text-kink-gold-bright">{props.title}</h1>
      <p className="mb-6 mt-3 text-sm leading-6 text-white/65">{props.description}</p>
      {props.error ? (
        <div role="alert" className="mb-4 rounded-xl border border-red-400/40 p-4 text-sm">
          {props.error}
          <button
            type="button"
            onClick={props.onRetry}
            disabled={props.saving}
            className="ml-3 underline text-kink-gold-bright"
          >
            Retry
          </button>
        </div>
      ) : null}
      {props.notice ? (
        <p role="status" className="mb-3 text-sm text-kink-gold-bright">
          {props.notice}
        </p>
      ) : null}
      {props.loading ? (
        <p role="status">Loading privacy settings…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-kink-gold-bright/25 bg-[#0c0c0c] divide-y divide-white/10">
          {props.fields.map((field) => (
            <div key={field.key}>
              <button
                type="button"
                aria-expanded={field.expanded}
                aria-controls={`${instanceId}-privacy-${field.key}`}
                onClick={field.onToggle}
                disabled={props.saving || field.unavailable || !field.audienceLabel}
                className="flex min-h-20 w-full items-center gap-3 p-4 text-left disabled:opacity-60"
              >
                <span aria-hidden="true" className="text-xl shrink-0">
                  {field.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-5">{field.label}</span>
                  <span className="mt-1 block text-sm text-kink-gold-bright">
                    {field.unavailable
                      ? "Available when this feature launches"
                      : field.audienceLabel}
                  </span>
                </span>
                <span aria-hidden="true" className="text-kink-gold-bright">
                  {field.expanded ? "⌃" : "⌄"}
                </span>
              </button>
              {field.expanded ? (
                <fieldset
                  id={`${instanceId}-privacy-${field.key}`}
                  disabled={props.saving}
                  className="mx-4 mb-4 rounded-xl border border-white/10 p-3"
                >
                  <legend className="sr-only">{field.label}</legend>
                  {field.hint ? (
                    <p className="px-2 pb-2 text-xs leading-5 text-white/60">{field.hint}</p>
                  ) : null}
                  {field.options.map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-11 cursor-pointer items-center gap-3 px-2 text-sm"
                    >
                      <input
                        type="radio"
                        name={`${instanceId}-audience-${field.key}`}
                        value={option.value}
                        checked={option.selected}
                        onChange={option.onSelect}
                        className="size-4 accent-kink-gold-bright"
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {props.saving ? (
        <p role="status" className="mt-3 text-sm text-kink-gold-bright">
          Saving…
        </p>
      ) : null}
    </section>
  );
}
