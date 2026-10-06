import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import webpush from "web-push";
import { DRIZZLE, type Db } from "../db/db.module";
import { profile, pushSubscription, pushVapidKey, user } from "../db/schema";
import { adminUserIds, notBanned } from "../moderation/admins";
import { NotificationsService, notificationUrl, type InboxEvent } from "./notifications.service";

/**
 * What a notification says and where tapping it goes. Discreet on purpose: on
 * an 18+ app, a lock screen shows who, never what anyone wrote.
 */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** Activity grouping hint; device alerts use the individual inbox id. */
  tag: string;
  /** The inbox row it stands for: tapping it marks that row read. */
  notificationId?: string;
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

  /**
   * Stores the event in the recipient's inbox, then tells their devices. What
   * the inbox doesn't store (a repeat, or a member they've blocked) isn't sent.
   */
  async deliver(userId: string, event: InboxEvent, message: PushMessage): Promise<number> {
    const notificationId = await this.inbox.record(userId, event);
    if (!notificationId) return 0;
    return this.sendTo(userId, { ...message, notificationId });
  }

  /** The member read a chat up to `upTo`: its inbox row clears too. Never fails the read. */
  chatRead(userId: string, conversationId: string, upTo: Date): void {
    void this.inbox
      .readConversation(userId, conversationId, upTo)
      .catch((e: unknown) => this.log.warn(`inbox read failed: ${String(e)}`));
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
    const payload = JSON.stringify(message);
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

  /** `sentAt` is the message's own time, so reading up to it clears the chat's inbox row. */
  newMessage(
    senderId: string,
    recipientId: string,
    conversationId: string,
    sentAt: Date = new Date(),
  ): void {
    if (senderId === recipientId) return;
    this.notify(async () => {
      const who = await this.member(senderId);
      return {
        to: recipientId,
        event: { type: "message", actorId: senderId, subjectId: conversationId, at: sentAt },
        message: {
          title: "Kinkord",
          body: `New message from ${who.name}`,
          url: notificationUrl("message", conversationId, null),
          tag: `chat-${conversationId}`,
        },
      };
    });
  }

  newFollower(followerId: string, followedId: string): void {
    if (followerId === followedId) return;
    this.notify(async () => {
      const who = await this.member(followerId);
      return {
        to: followedId,
        event: { type: "follow", actorId: followerId },
        message: {
          title: "Kinkord",
          body: `${who.name} followed you`,
          url: notificationUrl("follow", null, who.username),
          tag: `follow-${followerId}`,
        },
      };
    });
  }

  newComment(postId: string, authorId: string, commenterId: string): void {
    // Nobody needs telling they commented on their own post.
    if (authorId === commenterId) return;
    this.notify(async () => {
      const who = await this.member(commenterId);
      return {
        to: authorId,
        event: { type: "comment", actorId: commenterId, subjectId: postId },
        message: {
          title: "Kinkord",
          body: `${who.name} commented on your post`,
          url: notificationUrl("comment", postId, null),
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
    this.notify(async () => {
      const who = await this.member(actorId);
      return {
        to: authorId,
        event: { type, actorId, subjectId: postId },
        message: {
          title: "Kinkord",
          body: `${who.name} ${verb} your post`,
          url: notificationUrl(type, postId, null),
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
    this.toAdmins("report", "New report to review");
  }

  /** A verification Didit couldn't settle is waiting for an admin; says nothing about whose. */
  newVerificationReview(): void {
    this.toAdmins("verification", "New verification to review");
  }

  private toAdmins(type: "report" | "verification", body: string): void {
    void adminUserIds(this.db)
      .then((ids) =>
        Promise.all(
          ids.map((id) =>
            this.deliver(
              id,
              { type },
              { title: "Kinkord", body, url: notificationUrl(type, null, null), tag: type },
            ),
          ),
        ),
      )
      .catch((e) => this.log.warn(`push failed: ${String(e)}`));
  }

  /** Fire and forget: a notification that can't go out never fails what caused it. */
  private notify(
    build: () => Promise<{ to: string; event: InboxEvent; message: PushMessage } | null>,
  ): void {
    void build()
      .then((n) => (n ? this.deliver(n.to, n.event, n.message) : 0))
      .catch((e) => this.log.warn(`push failed: ${String(e)}`));
  }

  /** The name a push says, as the member is now; the inbox looks it up again when shown. */
  private async member(userId: string): Promise<{ name: string; username: string | null }> {
    const [row] = await this.db
      .select({ username: user.username, name: user.name, displayName: profile.displayName })
      .from(user)
      .leftJoin(profile, eq(profile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    return {
      name: row?.displayName ?? row?.username ?? row?.name ?? "Someone",
      username: row?.username ?? null,
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
