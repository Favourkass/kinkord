import { ImagePlus, X } from "lucide-react";

export interface ThreadComposerProps {
  heading: string;
  title: { label: string; placeholder: string; value: string; onChange: (v: string) => void };
  body: { label: string; placeholder: string; value: string; onChange: (v: string) => void };
  photos: { url: string; onRemove: () => void }[];
  addPhotosLabel: string;
  canAddPhotos: boolean;
  onAddPhotos: (files: File[]) => void;
  submit: { label: string; disabled: boolean; onClick: () => void };
  cancel: { label: string; onClick: () => void };
  error: string | null;
}

/** Start a discussion: a title, the message, up to four photos. */
export default function ThreadComposer(p: ThreadComposerProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        p.submit.onClick();
      }}
      className="space-y-3 rounded-2xl border border-kink-gold-bright/50 bg-app-card p-4"
    >
      <h2 className="text-base font-bold text-app-text">{p.heading}</h2>
      <label className="block text-xs font-semibold text-app-subtle">
        {p.title.label}
        <input
          value={p.title.value}
          onChange={(e) => p.title.onChange(e.target.value)}
          placeholder={p.title.placeholder}
          maxLength={120}
          className="mt-1 min-h-11 w-full rounded-xl border border-app-card-border bg-app-input px-3 text-sm text-app-text outline-none focus:border-kink-gold-bright"
        />
      </label>
      <label className="block text-xs font-semibold text-app-subtle">
        {p.body.label}
        <textarea
          value={p.body.value}
          onChange={(e) => p.body.onChange(e.target.value)}
          placeholder={p.body.placeholder}
          rows={5}
          className="mt-1 w-full rounded-xl border border-app-card-border bg-app-input p-3 text-sm text-app-text outline-none focus:border-kink-gold-bright"
        />
      </label>
      {p.photos.length ? (
        <ul className="flex flex-wrap gap-2">
          {p.photos.map((photo) => (
            <li key={photo.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a chosen photo */}
              <img src={photo.url} alt="" className="size-20 rounded-lg object-cover" />
              <button
                type="button"
                onClick={photo.onRemove}
                aria-label="Remove photo"
                className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-black/80 text-white"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {p.error ? (
        <p role="alert" className="text-sm text-app-danger">
          {p.error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {p.canAddPhotos ? (
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-kink-gold-bright">
            <ImagePlus size={18} aria-hidden="true" />
            {p.addPhotosLabel}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                p.onAddPhotos(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
        <span className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={p.cancel.onClick}
            className="min-h-10 rounded-xl border border-app-card-border px-4 text-sm text-app-value"
          >
            {p.cancel.label}
          </button>
          <button
            type="submit"
            disabled={p.submit.disabled}
            className="min-h-10 rounded-xl bg-kink-gold-bright px-4 text-sm font-bold text-black disabled:opacity-50"
          >
            {p.submit.label}
          </button>
        </span>
      </div>
    </form>
  );
}
