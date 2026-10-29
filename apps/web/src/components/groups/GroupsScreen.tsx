import Image from "next/image";
import Link from "next/link";
export interface GroupsScreenProps {
  heading: string;
  homeHref: string;
  groupsHref: string;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  creating: boolean;
  name: string;
  query: string;
  selectedCount: number;
  groups: Array<{ id: string; name: string; status: "invited" | "joined"; href: string }>;
  friends: Array<{ id: string; name: string; selected: boolean }>;
  detail: {
    isOwner: boolean;
    members: Array<{ id: string; name: string; status: "joined" | "invited"; canRemove: boolean }>;
    name: string;
    items: Array<{
      id: string;
      caption: string;
      sharedBy: string;
      canRemove: boolean;
      authorName: string;
      body: string | null;
      imageUrl: string | null;
      href: string;
    }>;
    hasMore: boolean;
  } | null;
  onCreateToggle: () => void;
  onName: (v: string) => void;
  onQuery: (v: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onLeave: () => void;
  onDelete: () => void;
  onRemovePost: (id: string) => void;
  onMore: () => void;
  onRemoveMember: (id: string) => void;
}
const gold = "rounded-xl bg-kink-gold-bright px-4 py-3 font-bold text-black disabled:opacity-40";
export default function GroupsScreen(p: GroupsScreenProps) {
  return (
    <main className="min-h-dvh bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-2xl space-y-5">
        <nav className="flex justify-between text-kink-gold-bright">
          <Link href={p.homeHref}>Kinkord</Link>
          <Link href={p.groupsHref}>All groups</Link>
        </nav>
        <h1 className="text-2xl font-bold">{p.heading}</h1>
        <p className="text-sm text-white/60">
          Private groups for sharing with friends. Only members can open the group. Original post
          privacy still applies.
        </p>
        {p.error && (
          <p role="alert" className="text-red-400">
            {p.error}
          </p>
        )}
        {p.notice && (
          <p role="status" className="text-kink-gold-bright">
            {p.notice}
          </p>
        )}
        {p.creating && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              p.onCreate();
            }}
            className="space-y-4 rounded-2xl border border-white/20 p-4"
          >
            <fieldset disabled={p.busy} className="space-y-4">
              {!p.detail && (
                <label className="block">
                  Group name
                  <input
                    value={p.name}
                    onChange={(e) => p.onName(e.target.value)}
                    maxLength={80}
                    required
                    className="mt-2 w-full rounded-xl bg-white/10 p-3"
                  />
                </label>
              )}
              <label className="block">
                Invite friends ({p.selectedCount}/50)
                <input
                  value={p.query}
                  onChange={(e) => p.onQuery(e.target.value)}
                  placeholder="Search friends"
                  className="mt-2 w-full rounded-xl bg-white/10 p-3"
                />
              </label>
              <p className="text-sm text-white/60">Friends must accept before viewing posts.</p>
              <div className="max-h-56 space-y-3 overflow-y-auto">
                {p.friends.map((f) => (
                  <label key={f.id} className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={f.selected}
                      disabled={!f.selected && p.selectedCount >= 50}
                      onChange={() => p.onSelect(f.id)}
                    />
                    {f.name}
                  </label>
                ))}
              </div>
              <button
                className={gold}
                disabled={(p.detail ? !p.selectedCount : !p.name.trim()) || p.busy}
              >
                {p.detail ? "Send invitations" : "Create group"}
              </button>
            </fieldset>
          </form>
        )}
        {p.loading ? (
          <p>Loading…</p>
        ) : !p.detail ? (
          <>
            <button onClick={p.onCreateToggle} className={gold}>
              {p.creating ? "Cancel" : "Create group"}
            </button>
            {!p.groups.length && <p>No groups yet. Create one and invite your friends.</p>}
            {p.groups.map((g) => (
              <article key={g.id} className="rounded-2xl border border-kink-gold-bright/20 p-4">
                {g.status === "joined" ? (
                  <Link href={g.href} className="font-bold text-kink-gold-bright">
                    {g.name} →
                  </Link>
                ) : (
                  <>
                    <h2 className="font-bold">{g.name}</h2>
                    <p className="my-2 text-sm">You’re invited to join this private group.</p>
                    <div className="flex gap-3">
                      <button disabled={p.busy} onClick={() => p.onAccept(g.id)} className={gold}>
                        Accept
                      </button>
                      <button disabled={p.busy} onClick={() => p.onDecline(g.id)}>
                        Decline
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
          </>
        ) : (
          <>
            {p.detail.isOwner && (
              <button className={gold} onClick={p.onCreateToggle}>
                {p.creating ? "Cancel invitations" : "Invite friends"}
              </button>
            )}
            <details className="rounded-xl border border-white/15 p-4">
              <summary className="cursor-pointer font-semibold text-kink-gold-bright">
                Members
              </summary>
              <div className="mt-3 space-y-3">
                {p.detail.members.map((member) => (
                  <div key={member.id} className="flex justify-between gap-3">
                    <span>
                      {member.name}
                      {member.status === "invited" ? " · Invited" : ""}
                    </span>
                    {member.canRemove && (
                      <button
                        disabled={p.busy}
                        onClick={() => p.onRemoveMember(member.id)}
                        className="text-sm text-white/60"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </details>
            <div className="flex gap-5 text-sm text-kink-gold-bright">
              {p.detail.isOwner ? (
                <button disabled={p.busy} onClick={p.onDelete}>
                  Delete group
                </button>
              ) : (
                <button disabled={p.busy} onClick={p.onLeave}>
                  Leave group
                </button>
              )}
            </div>
            {!p.detail.items.length && (
              <p>No visible posts yet. Use Share on a timeline post to share it with this group.</p>
            )}
            {p.detail.items.map((item) => (
              <article key={item.id} className="space-y-3 rounded-2xl border border-white/20 p-4">
                <p className="text-sm text-kink-gold-bright">{item.sharedBy} shared a post</p>
                {item.caption && <p className="whitespace-pre-wrap break-words">{item.caption}</p>}
                <Link
                  href={item.href}
                  className="block space-y-3 rounded-xl border border-white/10 p-3"
                >
                  <h2 className="font-bold">{item.authorName}</h2>
                  {item.body && (
                    <p className="line-clamp-6 whitespace-pre-wrap break-words">{item.body}</p>
                  )}
                  {item.imageUrl && (
                    <Image
                      unoptimized
                      width={640}
                      height={360}
                      src={item.imageUrl}
                      alt="Shared post"
                      className="max-h-72 w-full rounded-lg object-cover"
                    />
                  )}
                  <span className="block text-kink-gold-bright">Open post →</span>
                </Link>
                {item.canRemove && (
                  <button
                    disabled={p.busy}
                    onClick={() => p.onRemovePost(item.id)}
                    className="text-sm text-white/60"
                  >
                    Remove from group
                  </button>
                )}
              </article>
            ))}
            {p.detail.hasMore && (
              <button disabled={p.busy} onClick={p.onMore} className={gold}>
                More posts
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
