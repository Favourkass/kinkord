import Link from "next/link";
import { useEffect, useRef } from "react";
import { X, Share2, PencilLine, Users, UserRound, Copy, ArrowLeft } from "lucide-react";
import type { ExternalShare, ShareMode } from "@/domain/sharing";
export interface ShareDialogProps {
  open: boolean;
  mode: ShareMode;
  caption: string;
  query: string;
  loading: boolean;
  busy: boolean;
  error: string | null;
  friends: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string }>;
  groupsHref: string;
  copy: {
    title: string;
    close: string;
    now: string;
    caption: string;
    friend: string;
    group: string;
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
    noGroups: string;
    manageGroups: string;
    privateNotice: string;
    friendsNotice: string;
    limit: number;
  };
  onClose: () => void;
  onMode: (mode: ShareMode) => void;
  onCaption: (value: string) => void;
  onQuery: (value: string) => void;
  onFeed: () => void;
  onFriend: (id: string) => void;
  onGroup: (id: string) => void;
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
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-24px)] max-w-lg overflow-y-auto rounded-2xl border border-kink-gold-bright/30 bg-black p-5 text-white shadow-xl backdrop:bg-black/70"
    >
      <header className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold">{p.copy.title}</h2>
        <button aria-label={p.copy.close} disabled={p.busy} onClick={p.onClose} className="p-2">
          <X />
        </button>
      </header>
      <fieldset disabled={p.busy} className="space-y-4">
        {p.mode !== "choices" && (
          <button
            onClick={() => p.onMode("choices")}
            className="flex items-center gap-2 text-kink-gold-bright"
          >
            <ArrowLeft size={18} />
            {p.copy.back}
          </button>
        )}
        {p.mode !== "choices" && (
          <textarea
            aria-label={p.copy.caption}
            placeholder={p.copy.placeholder}
            value={p.caption}
            maxLength={p.copy.limit}
            onChange={(e) => p.onCaption(e.target.value)}
            rows={4}
            className="w-full resize-y rounded-xl border border-white/20 bg-white/5 p-3 text-base text-white placeholder:text-white/50 focus:border-kink-gold-bright"
          />
        )}
        {p.mode === "choices" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={p.onFeed} className={button}>
                <Share2 size={22} />
                {p.copy.now}
              </button>
              <button onClick={() => p.onMode("caption")} className={button}>
                <PencilLine size={22} />
                {p.copy.caption}
              </button>
              <button onClick={() => p.onMode("friends")} className={button}>
                <UserRound size={22} />
                {p.copy.friend}
              </button>
              <button onClick={() => p.onMode("groups")} className={button}>
                <Users size={22} />
                {p.copy.group}
              </button>
            </div>
            <h3 className="pt-2 text-sm text-white/60">{p.copy.external}</h3>
            <div className="grid grid-cols-2 gap-3">
              {(["whatsapp", "twitter", "native", "copy"] as const).map((target) => (
                <button key={target} onClick={() => p.onExternal(target)} className={button}>
                  {target === "copy" && <Copy size={18} />}
                  {p.copy[target]}
                </button>
              ))}
            </div>
          </>
        )}
        {p.mode === "caption" && (
          <button
            onClick={p.onFeed}
            className="w-full rounded-xl bg-kink-gold-bright py-3 font-bold text-black"
          >
            {p.copy.publish}
          </button>
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
        {p.mode === "groups" && (
          <>
            <p className="text-sm text-white/60">{p.copy.privateNotice}</p>
            {!p.loading && !p.error && !p.groups.length && <p>{p.copy.noGroups}</p>}
            {!p.loading &&
              p.groups.map((group) => (
                <button
                  key={group.id}
                  className={`${button} w-full`}
                  onClick={() => p.onGroup(group.id)}
                >
                  {group.name}
                </button>
              ))}
            <Link className="inline-block text-kink-gold-bright underline" href={p.groupsHref}>
              {p.copy.manageGroups}
            </Link>
          </>
        )}
        {p.loading && <p role="status">{p.copy.loading}</p>}
      </fieldset>
      {p.busy && (
        <p role="status" className="mt-4 text-kink-gold-bright">
          Sharing…
        </p>
      )}
      {p.error && (
        <p role="alert" className="mt-4 text-red-400">
          {p.error}
        </p>
      )}
    </dialog>
  );
}
