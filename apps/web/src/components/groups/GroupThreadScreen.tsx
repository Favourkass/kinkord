import Link from "next/link";
import { ChevronLeft, Heart, Lock, Pin } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import BodyText from "@/components/feed/BodyText";
import ConfirmDialog, { type ConfirmDialogProps } from "@/components/feed/ConfirmDialog";
import MediaLightbox from "@/components/feed/MediaLightbox";
import PostMediaGrid from "@/components/feed/PostMediaGrid";
import type { BodyPart } from "@/domain/mentions";
import type { PostMediaVM } from "@/domain/post";

interface Button {
  label: string;
  busy?: boolean;
  onClick: () => void;
}

export interface GroupThreadScreenProps {
  loading: boolean;
  loadError: string | null;
  back: { label: string; href: string };
  error: string | null;
  thread: {
    title: string;
    authorName: string;
    authorHref: string | null;
    avatarUrl: string | null;
    authorSilver: boolean;
    authorLabel: string | null;
    time: string;
    bodyParts: BodyPart[];
    media: PostMediaVM[];
    pinned: string | null;
    closed: string | null;
    likes: string;
    likedByMe: boolean;
    likeLabel: string;
    onLike: (() => void) | null;
    replies: string;
  } | null;
  onOpenMedia: (media: PostMediaVM) => void;
  lightbox: { media: PostMediaVM | null; onClose: () => void; closeLabel: string };
  actions: (Button & { key: string })[];
  replies: {
    title: string;
    rows: {
      id: string;
      authorName: string;
      authorHref: string | null;
      avatarUrl: string | null;
      authorSilver: boolean;
      time: string;
      bodyParts: BodyPart[];
      label: string | null;
      remove: Button | null;
    }[];
    empty: string | null;
    more: Button | null;
  };
  composer: {
    value: string;
    placeholder: string;
    onChange: (v: string) => void;
    submit: { label: string; disabled: boolean; onClick: () => void };
  } | null;
  composerNote: string | null;
  confirm: ConfirmDialogProps;
}

function Name({ name, href }: { name: string; href: string | null }) {
  return href ? (
    <Link href={href} className="font-semibold text-app-text hover:underline">
      {name}
    </Link>
  ) : (
    <span className="font-semibold text-app-text">{name}</span>
  );
}

/** One group discussion: the post, its replies oldest first, a reply box, the moderators' tools. */
export default function GroupThreadScreen(p: GroupThreadScreenProps) {
  const backLink = (
    <Link
      href={p.back.href}
      className="inline-flex items-center gap-1 text-sm text-kink-gold-bright"
    >
      <ChevronLeft size={16} aria-hidden="true" />
      {p.back.label}
    </Link>
  );
  if (p.loadError)
    return (
      <section className="mx-auto max-w-2xl px-4 py-10 text-app-text">
        {backLink}
        <p className="mt-6 text-app-subtle">{p.loadError}</p>
      </section>
    );
  const t = p.thread;
  if (!t) return <p className="px-4 py-10 text-sm text-app-subtle">…</p>;
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-5 text-app-text">
      {backLink}
      <article className="mt-3 rounded-2xl border border-app-card-border bg-app-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {t.pinned ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-kink-gold-bright">
              <Pin size={12} aria-hidden="true" />
              {t.pinned}
            </span>
          ) : null}
          {t.closed ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-app-subtle">
              <Lock size={12} aria-hidden="true" />
              {t.closed}
            </span>
          ) : null}
        </div>
        <h1 className="mt-1 text-xl font-bold leading-snug text-app-text">{t.title}</h1>
        <div className="mt-3 flex items-center gap-2 text-sm">
          <AvatarCircle src={t.avatarUrl} alt="" size={34} silver={t.authorSilver} />
          <span className="min-w-0">
            <Name name={t.authorName} href={t.authorHref} />
            {t.authorLabel ? (
              <span className="ml-2 rounded-full bg-kink-gold-bright/15 px-2 py-0.5 text-[11px] font-bold text-kink-gold-bright">
                {t.authorLabel}
              </span>
            ) : null}
            <span className="block text-xs text-app-subtle">{t.time}</span>
          </span>
        </div>
        <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-relaxed text-app-value">
          <BodyText parts={t.bodyParts} />
        </p>
        {t.media.length ? (
          <div className="mt-3">
            <PostMediaGrid media={t.media} onOpen={p.onOpenMedia} />
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {t.onLike ? (
            <button
              type="button"
              onClick={t.onLike}
              aria-pressed={t.likedByMe}
              aria-label={t.likeLabel}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 ${
                t.likedByMe
                  ? "border-kink-gold-bright text-kink-gold-bright"
                  : "border-app-card-border text-app-value"
              }`}
            >
              <Heart size={15} aria-hidden="true" fill={t.likedByMe ? "currentColor" : "none"} />
              {t.likes}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-app-subtle">
              <Heart size={15} aria-hidden="true" />
              {t.likes}
            </span>
          )}
          <span className="text-app-subtle">{t.replies}</span>
          <span className="ml-auto flex flex-wrap gap-2">
            {p.actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick}
                disabled={a.busy}
                className={`min-h-9 rounded-lg border px-3 text-xs font-semibold disabled:opacity-50 ${
                  a.key === "remove"
                    ? "border-app-danger/60 text-app-danger"
                    : "border-app-card-border text-app-value"
                }`}
              >
                {a.label}
              </button>
            ))}
          </span>
        </div>
      </article>

      {p.error ? (
        <p role="alert" className="mt-3 text-sm text-app-danger">
          {p.error}
        </p>
      ) : null}

      <h2 className="mt-6 text-sm font-bold text-kink-gold-bright">{p.replies.title}</h2>
      {p.replies.empty ? <p className="py-4 text-sm text-app-subtle">{p.replies.empty}</p> : null}
      <ul className="mt-3 space-y-3">
        {p.replies.rows.map((r) => (
          <li
            key={r.id}
            className="flex gap-3 rounded-2xl border border-app-card-border bg-app-card p-3"
          >
            <AvatarCircle src={r.avatarUrl} alt="" size={32} silver={r.authorSilver} />
            <div className="min-w-0 flex-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Name name={r.authorName} href={r.authorHref} />
                {r.label ? (
                  <span className="rounded-full bg-kink-gold-bright/15 px-2 py-0.5 text-[10px] font-bold text-kink-gold-bright">
                    {r.label}
                  </span>
                ) : null}
                <span className="text-xs text-app-subtle">{r.time}</span>
                {r.remove ? (
                  <button
                    type="button"
                    onClick={r.remove.onClick}
                    disabled={r.remove.busy}
                    className="ml-auto text-xs text-app-subtle underline disabled:opacity-50"
                  >
                    {r.remove.label}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-line break-words text-app-value">
                <BodyText parts={r.bodyParts} />
              </p>
            </div>
          </li>
        ))}
      </ul>
      {p.replies.more ? (
        <button
          type="button"
          onClick={p.replies.more.onClick}
          className="mt-3 text-sm font-semibold text-kink-gold-bright underline"
        >
          {p.replies.more.label}
        </button>
      ) : null}

      {p.composer ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.composer?.submit.onClick();
          }}
          className="mt-5 flex items-end gap-2"
        >
          <textarea
            value={p.composer.value}
            onChange={(e) => p.composer?.onChange(e.target.value)}
            placeholder={p.composer.placeholder}
            aria-label={p.composer.placeholder}
            rows={2}
            className="min-h-11 flex-1 rounded-xl border border-app-card-border bg-app-input p-3 text-sm text-app-text outline-none focus:border-kink-gold-bright"
          />
          <button
            type="submit"
            disabled={p.composer.submit.disabled}
            className="min-h-11 rounded-xl bg-kink-gold-bright px-4 text-sm font-bold text-black disabled:opacity-50"
          >
            {p.composer.submit.label}
          </button>
        </form>
      ) : null}
      {p.composerNote ? <p className="mt-5 text-sm text-app-subtle">{p.composerNote}</p> : null}

      <MediaLightbox {...p.lightbox} />
      <ConfirmDialog {...p.confirm} />
    </section>
  );
}
