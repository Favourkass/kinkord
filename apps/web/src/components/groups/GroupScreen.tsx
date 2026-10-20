import Link from "next/link";
import { ChevronLeft, Lock, MessageSquare, Pin } from "lucide-react";
import AvatarCircle from "@/components/app/AvatarCircle";
import ConfirmDialog, { type ConfirmDialogProps } from "@/components/feed/ConfirmDialog";
import ProfileTabs from "@/components/profile/ProfileTabs";
import GroupTile from "./GroupTile";
import ThreadComposer, { type ThreadComposerProps } from "./ThreadComposer";

interface Button {
  label: string;
  busy?: boolean;
  onClick: () => void;
}

interface Person {
  userId: string;
  name: string;
  href: string | null;
  avatarUrl: string | null;
}

export interface GroupScreenProps {
  loading: boolean;
  loadError: string | null;
  backHref: string;
  backLabel: string;
  header: {
    name: string;
    meta: string;
    members: string;
    privacy: string;
    closed: boolean;
    badge: string | null;
  } | null;
  primary: (Button & { quiet: boolean }) | null;
  editHref: string | null;
  editLabel: string;
  closeDown: Button | null;
  note: string | null;
  tabs: { key: string; label: string }[];
  tab: string;
  setTab: (key: string) => void;
  error: string | null;
  discussions: {
    canPost: boolean;
    joinNote: string | null;
    newLabel: string;
    rows: {
      id: string;
      href: string;
      title: string;
      authorName: string;
      avatarUrl: string | null;
      time: string;
      replies: string;
      excerpt: string;
      pinned: boolean;
      closed: boolean;
    }[];
    labels: { pinned: string; closed: string };
    empty: string | null;
    loading: boolean;
    loadingText: string;
    more: Button | null;
    composer: ThreadComposerProps & { open: boolean; onOpen: () => void };
  };
  about: {
    aboutTitle: string;
    description: string;
    rulesTitle: string;
    rules: string;
    privacyHint: string;
    teamTitle: string;
    team: (Person & { role: string })[];
    created: string;
  } | null;
  members: {
    rows: (Person & {
      role: string | null;
      remove: Button | null;
      moderator: Button | null;
    })[];
    empty: string | null;
    more: Button | null;
  };
  requests: {
    rows: (Person & { since: string; approve: Button; decline: Button })[];
    empty: string | null;
  };
  confirm: ConfirmDialogProps;
}

const smallButton =
  "min-h-9 rounded-lg border border-app-card-border px-3 text-xs font-semibold text-app-value disabled:opacity-50";

function PersonName({ person }: { person: Person }) {
  return person.href ? (
    <Link href={person.href} className="font-semibold text-app-text hover:underline">
      {person.name}
    </Link>
  ) : (
    <span className="font-semibold text-app-text">{person.name}</span>
  );
}

/** A group's page: who it is, joining, then its discussions, about, members and requests. */
export default function GroupScreen(p: GroupScreenProps) {
  if (p.loadError) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-10 text-app-text">
        <Link
          href={p.backHref}
          className="inline-flex items-center gap-1 text-sm text-kink-gold-bright"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {p.backLabel}
        </Link>
        <p className="mt-6 text-app-subtle">{p.loadError}</p>
      </section>
    );
  }
  if (!p.header) return <p className="px-4 py-10 text-sm text-app-subtle">…</p>;
  const d = p.discussions;
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-5 text-app-text">
      <Link
        href={p.backHref}
        className="inline-flex items-center gap-1 text-sm text-kink-gold-bright"
      >
        <ChevronLeft size={16} aria-hidden="true" />
        {p.backLabel}
      </Link>

      <header className="mt-3 rounded-2xl border border-app-card-border bg-app-card p-4">
        <div className="flex items-start gap-3">
          <GroupTile size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-app-text">{p.header.name}</h1>
            {p.header.meta ? <p className="mt-1 text-xs text-app-subtle">{p.header.meta}</p> : null}
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-app-subtle">
              <span>{p.header.members}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-app-input px-2 py-0.5 font-semibold">
                {p.header.closed ? <Lock size={11} aria-hidden="true" /> : null}
                {p.header.privacy}
              </span>
              {p.header.badge ? (
                <span className="rounded-full bg-kink-gold-bright/15 px-2 py-0.5 font-bold text-kink-gold-bright">
                  {p.header.badge}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {p.primary ? (
            <button
              type="button"
              onClick={p.primary.onClick}
              disabled={p.primary.busy}
              className={
                p.primary.quiet
                  ? "min-h-10 rounded-xl border border-app-card-border px-4 text-sm font-semibold text-app-value disabled:opacity-50"
                  : "min-h-10 rounded-xl bg-kink-gold-bright px-5 text-sm font-bold text-black disabled:opacity-50"
              }
            >
              {p.primary.label}
            </button>
          ) : null}
          {p.editHref ? (
            <Link
              href={p.editHref}
              className="inline-flex min-h-10 items-center rounded-xl border border-kink-gold-bright px-4 text-sm font-semibold text-kink-gold-bright"
            >
              {p.editLabel}
            </Link>
          ) : null}
          {p.closeDown ? (
            <button
              type="button"
              onClick={p.closeDown.onClick}
              className="min-h-10 rounded-xl px-3 text-sm text-app-danger underline"
            >
              {p.closeDown.label}
            </button>
          ) : null}
        </div>
        {p.note ? <p className="mt-3 text-sm text-app-subtle">{p.note}</p> : null}
      </header>

      {p.error ? (
        <p role="alert" className="mt-3 text-sm text-app-danger">
          {p.error}
        </p>
      ) : null}

      <div className="mt-4">
        <ProfileTabs tabs={p.tabs} active={p.tab} onSelect={p.setTab} />
      </div>

      {p.tab === "discussions" ? (
        <div className="mt-4 space-y-3">
          {d.canPost && !d.composer.open ? (
            <button
              type="button"
              onClick={d.composer.onOpen}
              className="min-h-11 w-full rounded-xl bg-kink-gold-bright text-sm font-bold text-black"
            >
              {d.newLabel}
            </button>
          ) : null}
          {d.composer.open ? <ThreadComposer {...d.composer} /> : null}
          {d.joinNote ? <p className="text-sm text-app-subtle">{d.joinNote}</p> : null}
          {d.empty ? <p className="py-8 text-center text-sm text-app-subtle">{d.empty}</p> : null}
          <ul className="space-y-3">
            {d.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="block rounded-2xl border border-app-card-border bg-app-card p-4 hover:border-kink-gold-bright/60"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    {row.pinned ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-kink-gold-bright">
                        <Pin size={12} aria-hidden="true" />
                        {d.labels.pinned}
                      </span>
                    ) : null}
                    {row.closed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-app-subtle">
                        <Lock size={12} aria-hidden="true" />
                        {d.labels.closed}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[15px] font-bold text-app-text">
                    {row.title}
                  </span>
                  {row.excerpt ? (
                    <span className="mt-1 line-clamp-2 block text-[13px] text-app-value">
                      {row.excerpt}
                    </span>
                  ) : null}
                  <span className="mt-2 flex items-center gap-2 text-[12px] text-app-subtle">
                    <AvatarCircle src={row.avatarUrl} alt="" size={20} />
                    <span className="truncate">{row.authorName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{row.time}</span>
                    <span className="ml-auto inline-flex items-center gap-1">
                      <MessageSquare size={13} aria-hidden="true" />
                      {row.replies}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {d.loading ? (
            <p role="status" className="text-sm text-app-subtle">
              {d.loadingText}
            </p>
          ) : null}
          {d.more ? (
            <button
              type="button"
              onClick={d.more.onClick}
              className="text-sm font-semibold text-kink-gold-bright underline"
            >
              {d.more.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {p.tab === "about" && p.about ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-app-card-border bg-app-card p-4">
            <h2 className="text-sm font-bold text-kink-gold-bright">{p.about.aboutTitle}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-app-value">{p.about.description}</p>
            <p className="mt-3 text-xs text-app-subtle">{p.about.privacyHint}</p>
            <p className="mt-1 text-xs text-app-subtle">{p.about.created}</p>
          </div>
          <div className="rounded-2xl border border-app-card-border bg-app-card p-4">
            <h2 className="text-sm font-bold text-kink-gold-bright">{p.about.rulesTitle}</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-app-value">{p.about.rules}</p>
          </div>
          <div className="rounded-2xl border border-app-card-border bg-app-card p-4">
            <h2 className="text-sm font-bold text-kink-gold-bright">{p.about.teamTitle}</h2>
            <ul className="mt-2 space-y-2">
              {p.about.team.map((person) => (
                <li key={person.userId} className="flex items-center gap-3 text-sm">
                  <AvatarCircle src={person.avatarUrl} alt="" size={32} />
                  <PersonName person={person} />
                  <span className="text-xs text-app-subtle">{person.role}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {p.tab === "members" ? (
        <div className="mt-4">
          {p.members.empty ? (
            <p className="py-8 text-center text-sm text-app-subtle">{p.members.empty}</p>
          ) : null}
          <ul className="space-y-2">
            {p.members.rows.map((m) => (
              <li
                key={m.userId}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-app-card-border bg-app-card p-3 text-sm"
              >
                <AvatarCircle src={m.avatarUrl} alt="" size={36} />
                <span className="min-w-0 flex-1">
                  <PersonName person={m} />
                  {m.role ? (
                    <span className="ml-2 text-xs text-kink-gold-bright">{m.role}</span>
                  ) : null}
                </span>
                {m.moderator ? (
                  <button
                    type="button"
                    onClick={m.moderator.onClick}
                    disabled={m.moderator.busy}
                    className={smallButton}
                  >
                    {m.moderator.label}
                  </button>
                ) : null}
                {m.remove ? (
                  <button
                    type="button"
                    onClick={m.remove.onClick}
                    disabled={m.remove.busy}
                    className={smallButton}
                  >
                    {m.remove.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {p.members.more ? (
            <button
              type="button"
              onClick={p.members.more.onClick}
              className="mt-4 text-sm font-semibold text-kink-gold-bright underline"
            >
              {p.members.more.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {p.tab === "requests" ? (
        <div className="mt-4">
          {p.requests.empty ? (
            <p className="py-8 text-center text-sm text-app-subtle">{p.requests.empty}</p>
          ) : null}
          <ul className="space-y-2">
            {p.requests.rows.map((r) => (
              <li
                key={r.userId}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-app-card-border bg-app-card p-3 text-sm"
              >
                <AvatarCircle src={r.avatarUrl} alt="" size={36} />
                <span className="min-w-0 flex-1">
                  <PersonName person={r} />
                  <span className="block text-xs text-app-subtle">{r.since}</span>
                </span>
                <button
                  type="button"
                  onClick={r.approve.onClick}
                  disabled={r.approve.busy}
                  className="min-h-9 rounded-lg bg-kink-gold-bright px-3 text-xs font-bold text-black disabled:opacity-50"
                >
                  {r.approve.label}
                </button>
                <button
                  type="button"
                  onClick={r.decline.onClick}
                  disabled={r.decline.busy}
                  className={smallButton}
                >
                  {r.decline.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ConfirmDialog {...p.confirm} />
    </section>
  );
}
