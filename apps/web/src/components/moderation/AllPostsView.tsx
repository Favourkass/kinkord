import type { AdminPostPM, AdminPostStatus, toAdminPostsVM } from "@/domain/adminPosts";
export interface AllPostsViewProps {
  vm: ReturnType<typeof toAdminPostsVM> | null;
  loading: boolean;
  error: string | null;
  status: AdminPostStatus;
  busy: boolean;
  onStatus: (status: AdminPostStatus) => void;
  onPrevious: () => void;
  onNext: () => void;
  onRetry: () => void;
  onArchive: (post: AdminPostPM) => void;
  onDelete: (post: AdminPostPM) => void;
}
const button =
  "rounded-xl border border-kink-amber px-3 py-2 text-sm font-bold text-kink-amber disabled:opacity-40";
export default function AllPostsView(p: AllPostsViewProps) {
  return (
    <section className="pt-6">
      <h2 className="text-xl font-bold text-app-text">All Kinkord posts</h2>
      <p className="mt-2 text-sm text-app-subtle">
        Every location and visibility, including friends-only posts. Newest first.
      </p>
      <label className="my-4 flex items-center gap-3 text-app-value">
        Status
        <select
          value={p.status}
          onChange={(e) => p.onStatus(e.target.value as AdminPostStatus)}
          className="rounded-lg border border-app-line bg-black p-2 text-white"
        >
          <option value="all">All posts</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="deleted">Deleted</option>
        </select>
      </label>
      {p.loading ? <p className="text-app-subtle">Loading posts…</p> : null}
      {p.error ? (
        <div role="alert" className="text-app-danger">
          {p.error}{" "}
          <button className={button} onClick={p.onRetry}>
            Retry
          </button>
        </div>
      ) : null}
      {!p.loading && !p.error && p.vm ? (
        <>
          <p className="mb-3 text-sm text-app-subtle">
            {p.vm.total} posts · Page {p.vm.page} of {p.vm.pages}
          </p>
          {!p.vm.rows.length ? <p className="text-app-subtle">No posts here.</p> : null}
          <ul className="space-y-4">
            {p.vm.rows.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-app-card-border bg-app-card p-4"
              >
                <p className="font-bold text-kink-amber">
                  {row.authorName} {row.username ? `@${row.username}` : ""}
                </p>
                <p className="mt-1 text-xs text-app-subtle">
                  {row.createdLabel} · {row.visibility === "friends" ? "Friends only" : "Public"} ·{" "}
                  {row.status}
                </p>
                {row.repostOfId ? (
                  <p className="mt-2 text-sm text-app-subtle">
                    Repost · Original post: {row.repostOfId}
                  </p>
                ) : null}
                <p className="my-3 whitespace-pre-wrap break-words text-app-value">
                  {row.body || "No text"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {row.media.map((media) =>
                    media.kind === "video" ? (
                      <video
                        key={media.id}
                        controls
                        preload="metadata"
                        src={media.url}
                        poster={media.thumbUrl ?? undefined}
                        className="max-h-64 w-full rounded-xl bg-black"
                        aria-label="Post video"
                      />
                    ) : (
                      <a
                        key={media.id}
                        href={media.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed admin media preview */}
                        <img
                          src={media.thumbUrl ?? media.url}
                          alt="Open post image"
                          className="h-28 w-28 rounded-xl object-cover"
                        />
                      </a>
                    ),
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {row.canArchive ? (
                    <button
                      type="button"
                      disabled={p.busy}
                      onClick={() => p.onArchive(row)}
                      className={button}
                    >
                      {row.archivedAt ? "Restore" : "Archive"}
                    </button>
                  ) : null}
                  {row.canDelete ? (
                    <button
                      type="button"
                      disabled={p.busy}
                      onClick={() => p.onDelete(row)}
                      className="rounded-xl border border-app-danger px-3 py-2 text-sm font-bold text-app-danger disabled:opacity-40"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <nav aria-label="Post pages" className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={p.onPrevious}
              disabled={p.vm.page <= 1 || p.busy}
              className={button}
            >
              Previous
            </button>
            <span className="text-sm text-app-subtle">
              {p.vm.page} / {p.vm.pages}
            </span>
            <button
              type="button"
              onClick={p.onNext}
              disabled={p.vm.page >= p.vm.pages || p.busy}
              className={button}
            >
              Next
            </button>
          </nav>
        </>
      ) : null}
    </section>
  );
}
