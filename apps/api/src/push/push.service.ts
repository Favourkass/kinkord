import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import webpush from "web-push";
import { DRIZZLE, type Db } from "../db/db.module";
import { profile, pushSubscription, pushVapidKey, user } from "../db/schema";
import { adminUserIds, notBanned } from "../moderation/admins";
import { NotificationsService } from "./notifications.service";
import type { NotificationType } from "../db/schema";

/**
 * What a notification says and where tapping it goes. Discreet on purpose: on
 * an 18+ app, a lock screen shows who, never what anyone wrote.
 */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** Same tag replaces the last one, so a busy chat is one notification, not twenty. */
  tag: string;
  notificationId?: string;
  actor?: { name: string; avatarKey: string | null };
}

export interface SubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/** How long a push service holds a notification for a phone that's off: a day. */
const TTL_SECONDS = 24 * 60 * 60;
const SEND_TIMEOUT_MS = 5_000;
/** Who to contact about our sends, as the VAPID spec asks. */
const VAPID_SUBJECT = "https://kinkord.com";

/** Web Push to members' phones and browsers. */
@Injectable()
export class PushService {
  private readonly log = new Logger(PushService.name);
  private keys: Promise<VapidKeys> | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly inbox: NotificationsService,
  ) {}

  /** Store once per recipient, before attempting optional device delivery. */
  async deliver(userId: string, type: NotificationType, message: PushMessage): Promise<number> {
    const notificationId = await this.inbox.create(userId, {
      type,
      title: message.title,
      body: message.body,
      url: message.url,
      ...(message.actor ? { actor: message.actor } : {}),
    });
    return this.sendTo(userId, { ...message, notificationId });
  }

  /** The key a browser subscribes with. */
  async publicKey(): Promise<string> {
    return (await this.vapid()).publicKey;
  }

  /** Remembers a device for this member; a device that switches accounts moves with it. */
  async subscribe(userId: string, sub: SubscriptionInput, userAgent: string | null): Promise<void> {
    await this.db
      .insert(pushSubscription)
      .values({
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
      })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: {
          userId,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent,
          updatedAt: sql`now()`,
        },
      });
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.db
      .delete(pushSubscription)
      .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
  }

  /**
   * Sends to every device this member has turned notifications on for, and
   * forgets the ones the push service says are gone. Nothing goes to a
   * suspended member.
   */
  async sendTo(userId: string, message: PushMessage): Promise<number> {
    const subs = await this.db
      .select()
      .from(pushSubscription)
      .where(and(eq(pushSubscription.userId, userId), notBanned(pushSubscription.userId)));
    if (subs.length === 0) return 0;
    const { publicKey, privateKey } = await this.vapid();
    const { actor: _actor, ...deviceMessage } = message;
    const payload = JSON.stringify(deviceMessage);
    const results = await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            {
              vapidDetails: { subject: VAPID_SUBJECT, publicKey, privateKey },
              TTL: TTL_SECONDS,
              urgency: "high",
              timeout: SEND_TIMEOUT_MS,
            },
          );
          return true;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            // Unsubscribed in the browser, or the app was uninstalled.
            await this.db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
          } else {
            this.log.warn(`push to a device failed: ${status ?? String(e)}`);
          }
          return false;
        }
      }),
    );
    return results.filter(Boolean).length;
  }

  newMessage(senderId: string, recipientId: string, conversationId: string): void {
    if (senderId === recipientId) return;
    this.notify("message", async () => {
      const who = await this.member(senderId);
      return {
        to: recipientId,
        message: {
          title: "Kinkord",
          body: `New message from ${who.name}`,
          actor: who,
          url: `/messages/${conversationId}`,
          tag: `chat-${conversationId}`,
        },
      };
    });
  }

  newFollower(followerId: string, followedId: string): void {
    if (followerId === followedId) return;
    this.notify("follow", async () => {
      const who = await this.member(followerId);
      return {
        to: followedId,
        message: {
          title: "Kinkord",
          body: `${who.name} followed you`,
          actor: who,
          url: who.username ? `/u/${encodeURIComponent(who.username)}` : "/home",
          tag: `follow-${followerId}`,
        },
      };
    });
  }

  newComment(postId: string, authorId: string, commenterId: string): void {
    // Nobody needs telling they commented on their own post.
    if (authorId === commenterId) return;
    this.notify("comment", async () => {
      const who = await this.member(commenterId);
      return {
        to: authorId,
        message: {
          title: "Kinkord",
          body: `${who.name} commented on your post`,
          actor: who,
          url: `/p/${postId}`,
          tag: `post-${postId}`,
        },
      };
    });
  }

  newLike(postId: string, authorId: string, actorId: string): void {
    this.postActivity("like", "liked", postId, authorId, actorId);
  }

  newRepost(postId: string, authorId: string, actorId: string): void {
    this.postActivity("repost", "reposted", postId, authorId, actorId);
  }

  private postActivity(
    type: "like" | "repost",
    verb: string,
    postId: string,
    authorId: string,
    actorId: string,
  ): void {
    if (authorId === actorId) return;
    this.notify(type, async () => {
      const who = await this.member(actorId);
      return {
        to: authorId,
        message: {
          title: "Kinkord",
          body: `${who.name} ${verb} your post`,
          actor: who,
          url: `/p/${postId}`,
          tag: `${type}-${postId}`,
        },
      };
    });
  }

  /**
   * Someone reported a member: every moderator hears of it at once, so a
   * report (an under-18 one above all) never sits unread. Says nothing about
   * who or why: that's for the moderation screen.
   */
  newReport(): void {
    void adminUserIds(this.db)
      .then((ids) =>
        Promise.all(
          ids.map((id) =>
            this.deliver(id, "report", {
              title: "Kinkord",
              body: "New report to review",
              url: "/moderation/reports",
              tag: "report",
            }),
          ),
        ),
      )
      .catch((e) => this.log.warn(`push failed: ${String(e)}`));
  }

  /** Fire and forget: a notification that can't go out never fails what caused it. */
  private notify(
    type: NotificationType,
    build: () => Promise<{ to: string; message: PushMessage } | null>,
  ): void {
    void build()
      .then((n) => (n ? this.deliver(n.to, type, n.message) : 0))
      .catch((e) => this.log.warn(`push failed: ${String(e)}`));
  }

  private async member(
    userId: string,
  ): Promise<{ name: string; username: string | null; avatarKey: string | null }> {
    const [row] = await this.db
      .select({
        username: user.username,
        name: user.name,
        displayName: profile.displayName,
        avatarKey: profile.avatarKey,
      })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    return {
      name: row?.displayName ?? row?.username ?? row?.name ?? "Someone",
      username: row?.username ?? null,
      avatarKey: row?.avatarKey ?? null,
    };
  }

  /** Made once, the first time anything needs them; two instances racing keep the first. */
  private vapid(): Promise<VapidKeys> {
    this.keys ??= this.loadOrCreateKeys().catch((e: unknown) => {
      this.keys = null;
      throw e;
    });
    return this.keys;
  }

  private async loadOrCreateKeys(): Promise<VapidKeys> {
    const existing = await this.readKeys();
    if (existing) return existing;
    const fresh = webpush.generateVAPIDKeys();
    await this.db
      .insert(pushVapidKey)
      .values({ id: 1, publicKey: fresh.publicKey, privateKey: fresh.privateKey })
      .onConflictDoNothing();
    const stored = await this.readKeys();
    if (!stored) throw new Error("push keys missing after creating them");
    return stored;
  }

  private async readKeys(): Promise<VapidKeys | null> {
    const [row] = await this.db
      .select({ publicKey: pushVapidKey.publicKey, privateKey: pushVapidKey.privateKey })
      .from(pushVapidKey)
      .where(eq(pushVapidKey.id, 1))
      .limit(1);
    return row ?? null;
  }
}
