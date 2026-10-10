import Link from "next/link";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { AdminTeamRowVM } from "@/domain/moderation";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";
import ConfirmDialog from "./ConfirmDialog";

export interface AdminTeamLabels {
  intro: string;
  locked: string;
  username: string;
  placeholder: string;
  add: string;
  remove: string;
  loading: string;
}

export interface AdminTeamViewProps {
  loading: boolean;
  error: string | null;
  rows: AdminTeamRowVM[];
  canManage: boolean;
  notice: string | null;
  dialog: AdminDialogVM | null;
  remove: (id: string) => void;
  form: {
    username: string;
    setUsername: (v: string) => void;
    error: string | null;
    submit: () => void;
  };
  labels: AdminTeamLabels;
}

export default function AdminTeamView({
  loading,
  error,
  rows,
  canManage,
  notice,
  dialog,
  remove,
  form,
  labels,
}: AdminTeamViewProps) {
  return (
    <div>
      <p className="text-[14px] leading-[20px] text-app-subtle">{labels.intro}</p>

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
              placeholder={labels.placeholder}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              maxLength={65}
              className="mt-[6px] h-[46px] w-full rounded-[12px] border border-app-input-border bg-app-input px-[12px] text-[16px] font-normal text-app-value placeholder:text-app-muted focus:border-kink-amber focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="h-[46px] rounded-[12px] bg-kink-amber px-[18px] text-[15px] font-bold text-black"
          >
            {labels.add}
          </button>
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

      <ul className="flex flex-col gap-[10px] pt-[16px]">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[12px]"
          >
            <Link href={r.href} className="flex min-w-0 flex-1 items-center gap-[12px]">
              <AvatarCircle src={r.avatarUrl} alt={r.title} size={44} />
              <span className="flex min-w-0 flex-col gap-[2px]">
                <span className="truncate text-[16px] font-bold text-app-name">{r.title}</span>
                <span className="truncate text-[14px] text-app-subtle">{r.handle}</span>
                {r.note ? <span className="text-[12px] text-app-muted">{r.note}</span> : null}
              </span>
            </Link>
            {r.removable ? (
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="h-[34px] shrink-0 rounded-[10px] px-[10px] text-[14px] font-bold text-app-subtle hover:bg-app-input"
              >
                {labels.remove}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {dialog ? <ConfirmDialog dialog={dialog} /> : null}
    </div>
  );
}
