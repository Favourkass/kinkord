import Link from "next/link";
import { useRef } from "react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { TeamPageAdminRowVM } from "@/domain/team";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";
import ConfirmDialog from "./ConfirmDialog";

export interface TeamPageAdminLabels {
  intro: string;
  publicNote: string;
  locked: string;
  username: string;
  usernamePlaceholder: string;
  title: string;
  titlePlaceholder: string;
  add: string;
  save: string;
  cancelEdit: string;
  change: string;
  remove: string;
  viewPage: string;
  loading: string;
}

export interface TeamPageAdminViewProps {
  loading: boolean;
  error: string | null;
  empty: string | null;
  rows: TeamPageAdminRowVM[];
  canManage: boolean;
  notice: string | null;
  dialog: AdminDialogVM | null;
  pageHref: string;
  edit: (id: string) => void;
  remove: (id: string) => void;
  form: {
    username: string;
    setUsername: (v: string) => void;
    title: string;
    setTitle: (v: string) => void;
    /** Changing someone's role rather than adding them. */
    editing: boolean;
    saving: boolean;
    error: string | null;
    submit: () => void;
    cancel: () => void;
  };
  labels: TeamPageAdminLabels;
}

const inputClass =
  "mt-[6px] h-[46px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[16px] font-normal text-app-value placeholder:text-app-muted focus:border-kink-amber focus:outline-none disabled:opacity-60";
const rowButton =
  "h-[34px] rounded-[10px] px-[10px] text-[14px] font-bold text-app-subtle hover:bg-app-input";

/** Moderation → Team page: who is on Meet the Team, and the role under each name. */
export default function TeamPageAdminView({
  loading,
  error,
  empty,
  rows,
  canManage,
  notice,
  dialog,
  pageHref,
  edit,
  remove,
  form,
  labels,
}: TeamPageAdminViewProps) {
  const titleInput = useRef<HTMLInputElement>(null);
  return (
    <div>
      <p className="text-[14px] leading-[20px] text-app-subtle">{labels.intro}</p>
      <p className="pt-[8px] text-[13px] leading-[18px] text-app-muted">{labels.publicNote}</p>
      <Link
        href={pageHref}
        className="mt-[8px] inline-block text-[14px] font-bold text-kink-amber hover:underline"
      >
        {labels.viewPage}
      </Link>

      {canManage ? (
        <form
          className="mt-[16px] flex flex-col gap-[10px] rounded-[16px] border border-app-card-border bg-app-card p-[14px] md:flex-row md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            form.submit();
          }}
        >
          <label className="flex-1 text-[13px] font-bold text-app-text">
            {labels.username}
            <input
              value={form.username}
              onChange={(e) => form.setUsername(e.target.value)}
              placeholder={labels.usernamePlaceholder}
              disabled={form.editing}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={65}
              className={inputClass}
            />
          </label>
          <label className="flex-1 text-[13px] font-bold text-app-text">
            {labels.title}
            <input
              ref={titleInput}
              value={form.title}
              onChange={(e) => form.setTitle(e.target.value)}
              placeholder={labels.titlePlaceholder}
              autoComplete="off"
              maxLength={60}
              className={inputClass}
            />
          </label>
          <span className="flex gap-[8px]">
            <button
              type="submit"
              disabled={form.saving}
              className="h-[46px] flex-1 rounded-[12px] bg-kink-amber px-[18px] text-[15px] font-bold text-black disabled:opacity-60 md:flex-none"
            >
              {form.editing ? labels.save : labels.add}
            </button>
            {form.editing ? (
              <button
                type="button"
                onClick={form.cancel}
                className="h-[46px] rounded-[12px] px-[14px] text-[15px] font-bold text-app-subtle hover:bg-app-input"
              >
                {labels.cancelEdit}
              </button>
            ) : null}
          </span>
        </form>
      ) : (
        <p className="pt-[12px] text-[14px] text-app-muted">{labels.locked}</p>
      )}
      {form.error ? <p className="pt-[8px] text-[14px] text-app-danger">{form.error}</p> : null}

      {notice ? (
        <p role="status" className="pt-[16px] text-[14px] text-app-value">
          {notice}
        </p>
      ) : null}
      {error ? <p className="pt-[16px] text-[14px] text-app-danger">{error}</p> : null}
      {loading ? <p className="pt-[16px] text-[14px] text-app-muted">{labels.loading}</p> : null}
      {empty ? <p className="pt-[16px] text-[14px] text-app-muted">{empty}</p> : null}

      <ul className="flex flex-col gap-[10px] pt-[16px]">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[12px]"
          >
            <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-[12px]">
              <AvatarCircle src={r.avatarUrl} alt={r.name} size={44} />
              <span className="flex min-w-0 flex-col gap-[2px]">
                <span className="truncate text-[16px] font-bold text-app-name">{r.name}</span>
                <span className="truncate text-[14px] text-app-subtle">{r.handle}</span>
                <span
                  className={`text-[13px] ${r.shown ? "font-bold text-kink-amber" : "text-app-muted"}`}
                >
                  {r.title}
                </span>
              </span>
            </Link>
            {canManage ? (
              <span className="flex shrink-0 flex-col items-end gap-[2px] md:flex-row md:items-center">
                {r.username ? (
                  <button
                    type="button"
                    onClick={() => {
                      edit(r.id);
                      titleInput.current?.focus();
                    }}
                    className={rowButton}
                  >
                    {labels.change}
                  </button>
                ) : null}
                <button type="button" onClick={() => remove(r.id)} className={rowButton}>
                  {labels.remove}
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {dialog ? <ConfirmDialog dialog={dialog} /> : null}
    </div>
  );
}
