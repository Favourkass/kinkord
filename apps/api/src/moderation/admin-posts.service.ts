import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { DRIZZLE, type Db } from "../db/db.module";
import { moderationLog, post, postMedia, profile, user } from "../db/schema";
import { StorageService } from "../storage/storage.service";

export type AdminPostStatus = "all" | "active" | "archived" | "deleted";
export const ADMIN_POSTS_PAGE_SIZE = 20;

@Injectable()
export class AdminPostsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
  ) {}

  /** Deliberately no location, feed ranking, friendship or author-ban filter: admin review sees all posts. */
  async list(page: number, status: AdminPostStatus) {
    const where =
      status === "active"
        ? and(isNull(post.deletedAt), isNull(post.archivedAt))
        : status === "archived"
          ? and(isNull(post.deletedAt), isNotNull(post.archivedAt))
          : status === "deleted"
            ? isNotNull(post.deletedAt)
            : undefined;
    const [totalRow] = await this.db.select({ total: count() }).from(post).where(where);
    const total = Number(totalRow?.total ?? 0);
    const currentPage = Math.min(page, Math.max(1, Math.ceil(total / ADMIN_POSTS_PAGE_SIZE)));
    const rows = await this.db
      .select({
        id: post.id,
        body: post.body,
        authorId: post.authorId,
        username: user.username,
        name: user.name,
        displayName: profile.displayName,
        createdAt: post.createdAt,
        visibility: post.visibility,
        archivedAt: post.archivedAt,
        deletedAt: post.deletedAt,
        repostOfId: post.repostOfId,
      })
      .from(post)
      .innerJoin(user, eq(user.id, post.authorId))
      .leftJoin(profile, eq(profile.userId, post.authorId))
      .where(where)
      .orderBy(desc(post.createdAt), desc(post.id))
      .limit(ADMIN_POSTS_PAGE_SIZE)
      .offset((currentPage - 1) * ADMIN_POSTS_PAGE_SIZE);
    const originalIds = [
      ...new Set(rows.flatMap((row) => (row.repostOfId ? [row.repostOfId] : []))),
    ];
    const originals = originalIds.length
      ? await this.db
          .select({ id: post.id, body: post.body })
          .from(post)
          .where(inArray(post.id, originalIds))
      : [];
    const originalBodies = new Map(originals.map((row) => [row.id, row.body]));
    const mediaIds = [
      ...new Set(rows.filter((row) => !row.deletedAt).map((row) => row.repostOfId ?? row.id)),
    ];
    const allMedia = mediaIds.length
      ? await this.db
          .select()
          .from(postMedia)
          .where(inArray(postMedia.postId, mediaIds))
          .orderBy(postMedia.position)
      : [];
    const items = await Promise.all(
      rows.map(async (row) => {
        const media = row.deletedAt
          ? []
          : allMedia.filter((m) => m.postId === (row.repostOfId ?? row.id));
        return {
          id: row.id,
          body: row.body ?? (row.repostOfId ? (originalBodies.get(row.repostOfId) ?? null) : null),
          authorId: row.authorId,
          username: row.username,
          authorName: row.displayName ?? row.name,
          createdAt: row.createdAt.toISOString(),
          visibility: row.visibility,
          archivedAt: row.archivedAt?.toISOString() ?? null,
          deletedAt: row.deletedAt?.toISOString() ?? null,
          repostOfId: row.repostOfId,
          media: await Promise.all(
            media.map(async (m) => ({
              id: m.id,
              kind: m.kind,
              url: await this.storage.presignDownload(m.key),
              thumbUrl:
                m.kind === "video"
                  ? m.posterKey
                    ? await this.storage.presignDownload(m.posterKey)
                    : null
                  : await this.storage.presignDownload(m.key, "sm"),
            })),
          ),
        };
      }),
    );
    return { items, total, page: currentPage, limit: ADMIN_POSTS_PAGE_SIZE };
  }

  async archive(actorId: string, id: string, archived: boolean) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(post)
        .set({ archivedAt: archived ? new Date() : null })
        .where(and(eq(post.id, id), isNull(post.deletedAt)))
        .returning({ authorId: post.authorId });
      if (!row) throw new NotFoundException("Post not found or already deleted.");
      await tx.insert(moderationLog).values({
        actorId,
        subjectUserId: row.authorId,
        subjectPostId: id,
        action: archived ? "archive-post" : "restore-post",
      });
      return { id, archived };
    });
  }
}
