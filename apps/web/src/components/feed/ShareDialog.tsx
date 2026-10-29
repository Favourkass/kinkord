import Image from "next/image";
import { useEffect, useRef } from "react";
import { X, Share2, Users, UserRound, Copy, ArrowLeft, Globe2, MessageCircle } from "lucide-react";
import type { ExternalShare, ShareMode } from "@/domain/sharing";
export interface ShareDialogProps {
  open: boolean;
  mode: ShareMode;
  caption: string;
  query: string;
  loading: boolean;
  busy: boolean;
  error: string | null;
  viewer: { name: string; avatarUrl: string | null };
  friends: Array<{ id: string; name: string; initial: string }>;
  copy: {
    title: string;
    feed: string;
    public: string;
    friendAudience: string;
    destinations: string;
    sharing: string;
    close: string;
    now: string;
    caption: string;
    friend: string;
    external: string;
    whatsapp: string;
    twitter: string;
    native: string;
    copy: string;
    placeholder: string;
    publish: string;
    back: string;
    search: string;
    loading: string;
    noFriends: string;
    friendsNotice: string;
    limit: number;
  };
  onClose: () => void;
  onMode: (mode: ShareMode) => void;
  onCaption: (value: string) => void;
  onQuery: (value: string) => void;
  onFeed: () => void;
  onFriend: (id: string) => void;
  onExternal: (target: ExternalShare) => void;
}
const button =
  "flex min-h-12 items-center gap-3 rounded-xl border border-white/15 px-4 py-3 text-left font-semibold text-kink-gold-bright hover:bg-white/10 disabled:opacity-40";
export default function ShareDialog(p: ShareDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (p.open && !ref.current?.open) ref.current?.showModal();
    else if (!p.open) ref.current?.close();
  }, [p.open]);
  return (
    <dialog
      ref={ref}
      aria-label={p.copy.title}
      onCancel={(e) => {
        e.preventDefault();
        p.onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) p.onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-b-0 border-white/10 bg-[#101010] p-0 text-white shadow-2xl backdrop:bg-black/60 motion-safe:animate-[share-sheet-in_180ms_ease-out]"
    >
      <div
        className="px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/30" aria-hidden="true" />
        <header className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/70">{p.copy.title}</h2>
          <button
            autoFocus
            aria-label={p.copy.close}
            disabled={p.busy}
            onClick={p.onClose}
            className="rounded-full p-2 hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </header>
        <fieldset disabled={p.busy} className="min-w-0 space-y-4">
          {p.mode !== "choices" && p.mode !== "caption" && (
            <button
              onClick={() => p.onMode("choices")}
              className="flex items-center gap-2 text-kink-gold-bright"
            >
              <ArrowLeft size={18} />
              {p.copy.back}
            </button>
          )}
          <section className="rounded-2xl border border-white/10 bg-[#191919] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-kink-gold-bright/15 text-kink-gold-bright">
                {p.viewer.avatarUrl ? (
                  <Image
                    src={p.viewer.avatarUrl}
                    alt=""
                    width={44}
                    height={44}
                    unoptimized
                    className="size-full object-cover"
                  />
                ) : (
                  <UserRound size={24} />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.viewer.name}</p>
                <div className="mt-1.5 flex gap-2 text-xs">
                  <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5">
                    <Users size={13} />
                    {p.mode === "friends" ? p.copy.friend : p.copy.feed}
                  </span>
                  <span className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5">
                    <Globe2 size={13} />
                    {p.mode === "friends" ? p.copy.friendAudience : p.copy.public}
                  </span>
                </div>
              </div>
            </div>
            <textarea
              aria-label={p.copy.caption}
              placeholder={p.copy.placeholder}
              value={p.caption}
              maxLength={p.copy.limit}
              onChange={(e) => p.onCaption(e.target.value)}
              rows={3}
              className="mt-4 block min-h-24 w-full resize-none bg-transparent text-base text-white outline-none placeholder:text-white/45 focus-visible:ring-1 focus-visible:ring-kink-gold-bright/50"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <Globe2 size={14} />
                {p.mode === "friends" ? p.copy.friendAudience : p.copy.public}
              </span>
              {(p.mode === "choices" || p.mode === "caption") && (
                <button
                  onClick={p.onFeed}
                  className="rounded-xl bg-kink-gold-bright px-5 py-3 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
                >
                  {p.copy.now}
                </button>
              )}
            </div>
          </section>
          {(p.mode === "choices" || p.mode === "caption") && (
            <>
              <div className="flex gap-4 overflow-x-auto pb-2 pt-1" aria-label={p.copy.friend}>
                {p.friends.slice(0, 8).map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => p.onFriend(friend.id)}
                    className="flex w-16 shrink-0 flex-col items-center gap-2 text-center text-xs"
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-14 items-center justify-center rounded-full border border-kink-gold-bright/25 bg-kink-gold-bright/10 text-xl font-semibold text-kink-gold-bright"
                    >
                      {friend.initial}
                    </span>
                    <span className="line-clamp-2">{friend.name}</span>
                  </button>
                ))}
                <button
                  onClick={() => p.onMode("friends")}
                  className="flex w-16 shrink-0 flex-col items-center gap-2 text-center text-xs"
                >
                  <span className="flex size-14 items-center justify-center rounded-full bg-white/10 text-kink-gold-bright">
                    <UserRound size={25} />
                  </span>
                  {p.copy.friend}
                </button>
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="mb-3 text-xs font-semibold text-white/50">{p.copy.destinations}</p>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {(["whatsapp", "twitter", "native", "copy"] as const).map((target) => (
                    <button
                      key={target}
                      onClick={() => p.onExternal(target)}
                      className="flex w-16 shrink-0 flex-col items-center gap-2 text-center text-xs"
                    >
                      <span className="flex size-14 items-center justify-center rounded-full bg-kink-gold-bright/15 text-kink-gold-bright">
                        {target === "copy" ? (
                          <Copy size={24} />
                        ) : target === "whatsapp" ? (
                          <MessageCircle size={28} />
                        ) : target === "twitter" ? (
                          <span className="text-2xl font-bold">𝕏</span>
                        ) : (
                          <Share2 size={24} />
                        )}
                      </span>
                      {p.copy[target]}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {p.mode === "friends" && (
            <>
              <p className="text-sm text-white/60">{p.copy.friendsNotice}</p>
              <input
                aria-label={p.copy.search}
                placeholder={p.copy.search}
                value={p.query}
                onChange={(e) => p.onQuery(e.target.value)}
                className="w-full rounded-xl bg-white/10 p-3"
              />
              {!p.loading && !p.error && !p.friends.length && <p>{p.copy.noFriends}</p>}
              {!p.loading &&
                p.friends.map((friend) => (
                  <button
                    key={friend.id}
                    className={`${button} w-full`}
                    onClick={() => p.onFriend(friend.id)}
                  >
                    {friend.name}
                  </button>
                ))}
            </>
          )}
          {p.loading && <p role="status">{p.copy.loading}</p>}
        </fieldset>
        {p.busy && (
          <p role="status" className="mt-4 text-kink-gold-bright">
            {p.copy.sharing}
          </p>
        )}
        {p.error && (
          <p role="alert" className="mt-4 text-red-400">
            {p.error}
          </p>
        )}
      </div>
    </dialog>
  );
}
