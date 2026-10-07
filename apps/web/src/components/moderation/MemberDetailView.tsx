import Link from "next/link";
import type { ReactNode } from "react";
import AvatarCircle from "@/components/app/AvatarCircle";
import type { AdminMemberDetailVM } from "@/domain/moderation";
import type { AdminDialogVM } from "@/presenters/useAdminMemberPresenter";
import Badges from "./Badges";
import ConfirmDialog from "./ConfirmDialog";

export interface MemberDetailLabels {
  back: string;
  posts: string;
  noPosts: string;
  rules: string;
  protectedAccount: string;
  actions: {
    block: string;
    unblock: string;
    deletePosts: string;
    deleteAccount: string;
    deletePost: string;
  };
}

export interface MemberDetailViewProps {
  vm: AdminMemberDetailVM | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  dialog: AdminDialogVM | null;
  labels: MemberDetailLabels;
  backHref: string;
  onBlock: () => void;
  onUnblock: () => void;
  onDeletePosts: () => void;
  onDeleteAccount: () => void;
  onDeletePost: (postId: string) => void;
  /** Their Silver check, when they have Silver. */
  silverCheck?: ReactNode;
}

const outline =
  "h-[44px] rounded-[12px] border px-[16px] text-[15px] font-bold disabled:opacity-40";

export default function MemberDetailView({
  vm,
  loading,
  error,
  notice,
  dialog,
  labels,
  backHref,
  onBlock,
  onUnblock,
  onDeletePosts,
  onDeleteAccount,
  onDeletePost,
  silverCheck,
}: MemberDetailViewProps) {
  return (
    <div>
      <Link href={backHref} className="text-[14px] font-bold text-app-subtle hover:text-app-value">
        ← {labels.back}
      </Link>

      {error ? <p className="pt-[16px] text-[14px] text-app-danger">{error}</p> : null}
      {loading ? <p className="pt-[16px] text-[14px] text-app-muted">…</p> : null}

      {vm ? (
        <>
          <header className="flex items-center gap-[14px] pt-[16px]">
            <AvatarCircle src={vm.avatarUrl} alt={vm.title} size={64} />
            <div className="min-w-0">
              <p className="truncate text-[20px] font-bold text-app-name">{vm.title}</p>
              <p className="text-[14px] text-app-subtle">{vm.handle}</p>
              <div className="pt-[4px]">
                <Badges badges={vm.badges} />
              </div>
            </div>
          </header>

          {notice ? (
            <p className="mt-[16px] rounded-[12px] bg-app-input px-[14px] py-[10px] text-[14px] text-app-value">
              {notice}
            </p>
          ) : null}
          {vm.banNote ? (
            <p className="mt-[12px] rounded-[12px] bg-app-danger-soft px-[14px] py-[10px] text-[14px] text-app-danger">
              {vm.banNote}
            </p>
          ) : null}

          <dl className="mt-[16px] grid grid-cols-1 gap-[10px] rounded-[16px] border border-app-card-border bg-app-card p-[14px] md:grid-cols-2">
            {vm.facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[12px] font-bold uppercase tracking-wide text-app-muted">
                  {f.label}
                </dt>
                <dd className="break-all text-[15px] text-app-value">{f.value}</dd>
              </div>
            ))}
          </dl>

          {vm.protectedAccount ? (
            <p className="pt-[16px] text-[14px] text-app-subtle">{labels.protectedAccount}</p>
          ) : (
            <div className="flex flex-col gap-[10px] pt-[16px] md:flex-row md:flex-wrap">
              {vm.banned ? (
                <button
                  type="button"
                  onClick={onUnblock}
                  className={`${outline} border-app-input-border bg-app-input text-app-value`}
                >
                  {labels.actions.unblock}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onBlock}
                  className="h-[44px] rounded-[12px] bg-kink-amber px-[16px] text-[15px] font-bold text-black"
                >
                  {labels.actions.block}
                </button>
              )}
              <button
                type="button"
                onClick={onDeletePosts}
                disabled={vm.postCount === 0}
                className={`${outline} border-app-danger bg-transparent text-app-danger`}
              >
                {labels.actions.deletePosts}
              </button>
              <button
                type="button"
                onClick={onDeleteAccount}
                className="h-[44px] rounded-[12px] bg-app-danger px-[16px] text-[15px] font-bold text-white"
              >
                {labels.actions.deleteAccount}
              </button>
            </div>
          )}

          {silverCheck}

          <h2 className="pt-[28px] pb-[10px] text-[14px] font-bold text-app-text">
            {labels.posts} · {vm.postCount}
          </h2>
          {vm.posts.length === 0 ? (
            <p className="text-[14px] text-app-subtle">{labels.noPosts}</p>
          ) : (
            <ul className="flex flex-col gap-[10px]">
              {vm.posts.map((p) => (
                <li
                  key={p.id}
                  className="flex gap-[12px] rounded-[16px] border border-app-card-border bg-app-card p-[12px]"
                >
                  {p.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not optimizable
                    <img
                      src={p.thumbUrl}
                      alt=""
                      className="h-[64px] w-[64px] shrink-0 rounded-[10px] object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-3 whitespace-pre-line break-words text-[15px] text-app-value">
                      {p.text}
                    </p>
                    <p className="pt-[4px] text-[12px] text-app-muted">{p.meta}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeletePost(p.id)}
                    className="h-[36px] shrink-0 self-start rounded-[10px] px-[10px] text-[14px] font-bold text-app-danger hover:bg-app-danger-soft"
                  >
                    {labels.actions.deletePost}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {vm.rules.length > 0 ? (
            <>
              <h2 className="pt-[28px] pb-[10px] text-[14px] font-bold text-app-text">
                {labels.rules}
              </h2>
              <ul className="flex flex-col gap-[8px]">
                {vm.rules.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-[12px] border border-app-card-border bg-app-card px-[12px] py-[8px]"
                  >
                    <p className="break-all text-[14px] text-app-value">
                      <span className="font-bold">{r.kind}:</span> {r.value}
                    </p>
                    <p className="text-[12px] text-app-muted">
                      {r.action}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}

      {dialog ? <ConfirmDialog dialog={dialog} /> : null}
    </div>
  );
}
