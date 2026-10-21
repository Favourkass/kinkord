import Link from "next/link";
import type { ReactNode } from "react";
import AvatarCircle from "@/components/app/AvatarCircle";
import ConfirmDialog, { type ConfirmDialogProps } from "@/components/feed/ConfirmDialog";
import type { RelationshipChoiceVM, RelationshipRowVM } from "@/domain/relationship";

export interface RelationshipsScreenProps {
  loading: boolean;
  error: string | null;
  notice: string | null;
  form: {
    username: string;
    setUsername: (v: string) => void;
    type: string;
    setType: (v: string) => void;
    choices: { ds: RelationshipChoiceVM[]; romantic: RelationshipChoiceVM[] };
    error: string | null;
    busy: boolean;
    submit: () => void;
  };
  incoming: (RelationshipRowVM & {
    line: string;
    disabled: boolean;
    accept: () => void;
    decline: () => void;
  })[];
  outgoing: (RelationshipRowVM & { line: string; disabled: boolean; cancel: () => void })[];
  links: (RelationshipRowVM & { disabled: boolean; end: () => void })[];
  endConfirm: ConfirmDialogProps;
  labels: {
    title: string;
    intro: string;
    form: {
      title: string;
      username: string;
      usernamePlaceholder: string;
      type: string;
      typePlaceholder: string;
      dsGroup: string;
      romanticGroup: string;
      send: string;
      sending: string;
    };
    incoming: string;
    outgoing: string;
    links: string;
    noLinks: string;
    accept: string;
    decline: string;
    cancel: string;
    end: string;
    loading: string;
  };
}

function Person({ row, children }: { row: RelationshipRowVM; children: ReactNode }) {
  const avatar = <AvatarCircle src={row.avatarUrl} alt={row.name} size={44} />;
  return (
    <li className="flex items-center gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[12px]">
      {row.href ? <Link href={row.href}>{avatar}</Link> : avatar}
      {children}
    </li>
  );
}

const quiet =
  "h-[34px] shrink-0 rounded-[10px] px-[10px] text-[14px] font-bold text-app-subtle hover:bg-app-input disabled:opacity-50";

/** Your links, the requests waiting either way, and the form to ask someone. */
export default function RelationshipsScreen(p: RelationshipsScreenProps) {
  const l = p.labels;
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-[20px] px-4 py-6 text-app-text">
      <header>
        <h1 className="text-2xl font-bold text-kink-gold-bright">{l.title}</h1>
        <p className="mt-2 text-sm text-app-subtle">{l.intro}</p>
      </header>

      <form
        className="flex flex-col gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[14px]"
        onSubmit={(e) => {
          e.preventDefault();
          p.form.submit();
        }}
      >
        <h2 className="text-[16px] font-bold text-app-name">{l.form.title}</h2>
        <label className="text-[13px] font-bold text-app-text">
          {l.form.username}
          <input
            value={p.form.username}
            onChange={(e) => p.form.setUsername(e.target.value)}
            placeholder={l.form.usernamePlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={31}
            className="mt-[6px] h-[46px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[16px] font-normal text-app-value placeholder:text-app-muted focus:border-kink-amber focus:outline-none"
          />
        </label>
        <label className="text-[13px] font-bold text-app-text">
          {l.form.type}
          <select
            value={p.form.type}
            onChange={(e) => p.form.setType(e.target.value)}
            className="mt-[6px] h-[46px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[16px] font-normal text-app-value focus:border-kink-amber focus:outline-none"
          >
            <option value="">{l.form.typePlaceholder}</option>
            <optgroup label={l.form.dsGroup}>
              {p.form.choices.ds.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </optgroup>
            <optgroup label={l.form.romanticGroup}>
              {p.form.choices.romantic.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <button
          type="submit"
          disabled={p.form.busy}
          className="h-[46px] rounded-[12px] bg-kink-amber px-[18px] text-[15px] font-bold text-black disabled:opacity-60"
        >
          {p.form.busy ? l.form.sending : l.form.send}
        </button>
        {p.form.error ? <p className="text-[14px] text-app-danger">{p.form.error}</p> : null}
      </form>

      {p.notice ? (
        <p role="status" className="text-[14px] text-app-value">
          {p.notice}
        </p>
      ) : null}
      {p.error ? <p className="text-[14px] text-app-danger">{p.error}</p> : null}
      {p.loading ? <p className="text-[14px] text-app-muted">{l.loading}</p> : null}

      {p.incoming.length > 0 ? (
        <div className="flex flex-col gap-[10px]">
          <h2 className="text-[16px] font-bold text-app-name">{l.incoming}</h2>
          <ul className="flex flex-col gap-[10px]">
            {p.incoming.map((r) => (
              <Person key={r.id} row={r}>
                <span className="min-w-0 flex-1 text-[14px] text-app-text">{r.line}</span>
                <span className="flex shrink-0 flex-col items-end gap-[2px] md:flex-row md:items-center">
                  <button
                    type="button"
                    onClick={r.accept}
                    disabled={r.disabled}
                    className="h-[34px] rounded-[10px] bg-kink-amber px-[12px] text-[14px] font-bold text-black disabled:opacity-50"
                  >
                    {l.accept}
                  </button>
                  <button type="button" onClick={r.decline} disabled={r.disabled} className={quiet}>
                    {l.decline}
                  </button>
                </span>
              </Person>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-[10px]">
        <h2 className="text-[16px] font-bold text-app-name">{l.links}</h2>
        {!p.loading && p.links.length === 0 ? (
          <p className="text-[14px] text-app-muted">{l.noLinks}</p>
        ) : null}
        <ul className="flex flex-col gap-[10px]">
          {p.links.map((r) => (
            <Person key={r.id} row={r}>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] text-app-subtle">{r.label}</span>
                <span className="truncate text-[16px] font-bold text-app-name">{r.name}</span>
              </span>
              <button type="button" onClick={r.end} disabled={r.disabled} className={quiet}>
                {l.end}
              </button>
            </Person>
          ))}
        </ul>
      </div>

      {p.outgoing.length > 0 ? (
        <div className="flex flex-col gap-[10px]">
          <h2 className="text-[16px] font-bold text-app-name">{l.outgoing}</h2>
          <ul className="flex flex-col gap-[10px]">
            {p.outgoing.map((r) => (
              <Person key={r.id} row={r}>
                <span className="min-w-0 flex-1 text-[14px] text-app-text">{r.line}</span>
                <button type="button" onClick={r.cancel} disabled={r.disabled} className={quiet}>
                  {l.cancel}
                </button>
              </Person>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog {...p.endConfirm} />
    </section>
  );
}
