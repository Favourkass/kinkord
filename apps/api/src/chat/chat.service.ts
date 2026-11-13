import { deliveryAckSql } from "./receipts";
import { privacyAllows, privateProfileValue } from "../privacy/privacy-policy";
import { messageBadgeCount } from "./inbox-badge";
import { teamBadge } from "../members/team-badge";
import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { DRIZZLE, type Db } from "../db/db.module";
import {
  chatInboxSeen,
  conversation,
  conversationParticipant,
  message,
  messageEdit,
  messageHidden,
  profile,
  user,
} from "../db/schema";
import { isSuperAdmin, notBanned } from "../moderation/admins";
import { ONLINE_WINDOW_SECONDS, PresenceService } from "../presence/presence.service";
import { containsPattern } from "../push/notifications.service";
import { PushService } from "../push/push.service";
import { RealtimeService } from "../realtime/realtime.service";
import { blockedBy, notBlocking } from "../safety/blocks";
import {
  IMAGE_VARIANTS,
  StorageService,
  variantKey,
  type ImageVariant,
} from "../storage/storage.service";
import { hasSilver, silverCheck } from "../subscriptions/plans";
import { chatDay, NEW_CHAT_LIMIT, newChatsPerDay } from "./allowance";
import { CROSS_COUNTRY_MESSAGE, CROSS_COUNTRY_PREMIUM, differentCountries } from "./cross-country";
import {
  DELETE_FOR_EVERYONE_HOURS,
  EDIT_WINDOW_MINUTES,
  type ChatAllowanceDto,
  type ChatPeerDto,
  type InboxCountsDto,
  type InboxFilter,
  type ChatPhotoDto,
  type ConversationSummaryDto,
  type ConversationThreadDto,
  type ForwardResultDto,
  type MessageDto,
  type SendMessageInput,
} from "./dto";

/**
 * Empty threads a member may open within a day. Conversations with messages
 * use the separate new-chat allowance, so this guard cannot cap Premium at 30.
 */
export const MAX_EMPTY_CONVERSATIONS_PER_DAY = 30;
/** Messages a member may send per minute, across all their threads. */
export const MAX_MESSAGES_PER_MINUTE = 30;
const LIST_LIMIT = 50;
/** A typing start reaches the other member at most this often. */
const TYPING_MIN_GAP_MS = 1_000;
/**
 * A repeat of the same hint is only sent again after this long: under the
 * app's 5s heartbeat, so ordinary network jitter never drops a renewal.
 */
const TYPING_REPEAT_MS = 4_000;

// Aliased so the inbox can look at a chat's other member and its messages from inside the inbox query.
const searchParticipant = alias(conversationParticipant, "search_participant");
const searchUser = alias(user, "search_user");
const searchProfile = alias(profile, "search_profile");
const searchMessage = alias(message, "search_message");
const inboxPeer = alias(conversationParticipant, "inbox_peer");
const inboxPeerProfile = alias(profile, "inbox_peer_profile");
const inboxMessage = alias(message, "inbox_message");

/** A chat photo opens full screen, so it gets the same budget as a post photo. */
export const CHAT_PHOTO_MAX_MB = 10;
const photoMaxBytes = CHAT_PHOTO_MAX_MB * 1024 * 1024;
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
/** `chat/<conversationId>/<senderId>/<uuid>.jpg`: who uploaded it, for which thread. */
export const CHAT_PHOTO_PREFIX = "chat";
const photoPrefix = (conversationId: string, userId: string) =>
  `${CHAT_PHOTO_PREFIX}/${conversationId}/${userId}/`;
/** Photos open up once the other member has written in the thread. */
export const PHOTOS_LOCKED = "You can send photos once they've written to you.";
/** Privacy restrictions do not offer a Premium upgrade as a way around consent. */
export const MESSAGING_PRIVACY = "MESSAGING_PRIVACY";
export const MESSAGING_PRIVACY_MESSAGE =
  "Your privacy settings or this member's privacy settings do not allow messaging between you.";
const messagingDenied = () =>
  new ForbiddenException({ code: MESSAGING_PRIVACY, message: MESSAGING_PRIVACY_MESSAGE });
/** Said to a member writing to someone they blocked; the blocked side reads them as gone. */
export const YOU_BLOCKED = "You've blocked this member. Unblock them to send messages.";
const photoTooLarge = () => `Photo is too large — max ${CHAT_PHOTO_MAX_MB}MB.`;
export const MESSAGE_NOT_FOUND = "Message not found.";
export const MESSAGE_DELETED = "This message was deleted.";
export const EDIT_NOT_YOURS = "You can only edit your own messages.";
export const EDIT_FORWARDED = "A forwarded message can't be edited.";
export const EDIT_WINDOW_PASSED = `Messages can only be edited for ${EDIT_WINDOW_MINUTES} minutes after sending.`;
export const DELETE_NOT_YOURS = "You can only delete your own messages for everyone.";
export const DELETE_WINDOW_PASSED = `Messages can only be deleted for everyone within ${DELETE_FOR_EVERYONE_HOURS} hours of sending.`;
/**
 * Someone else's chat photos stay with whoever they were sent to: forwarding
 * them on is how private photos get spread without consent.
 */
export const FORWARD_PHOTO_NOT_YOURS = "Photos someone else sent you can't be forwarded.";
const EDIT_WINDOW_MS = EDIT_WINDOW_MINUTES * 60_000;
const DELETE_WINDOW_MS = DELETE_FOR_EVERYONE_HOURS * 3_600_000;
/** The most edited or deleted messages one poll picks up: far more than a few seconds bring. */
const CHANGES_PAGE = 500;
const photoTypes = () => `contentType must be one of: ${Object.keys(PHOTO_TYPES).join(", ")}`;

type MessageRow = typeof message.$inferSelect;
/** Who's asking: the session user, whose verified email decides their limits. */
type Member = { id: string; email: string; emailVerified: boolean };
/** The client or an open transaction: both run the same queries. */
type Queryable = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

/** A sortable, unique position for a message: time first, id to break ties. */
function positionOf(id: string) {
  return sql`(select "created_at", "id" from "message" where "id" = ${id})`;
}

/** Not deleted by this member for themselves ("Delete for me"). */
function notHiddenFor(userId: string, messageId: SQL | AnyColumn = message.id): SQL {
  return sql`not exists (select 1 from ${messageHidden} where ${messageHidden.userId} = ${userId} and ${messageHidden.messageId} = ${messageId})`;
}

/**
 * When a message last changed after it was sent: edited, or deleted for
 * everyone. Cut to the millisecond, as the app reads it back, so the time the
 * app sends as `changedSince` doesn't match the same change again.
 */
const changedAt = sql`date_trunc('milliseconds', greatest(${message.editedAt}, ${message.deletedAt}))`;

/** What an HTTP refusal says, for a forward's per-chat result. */
function refusalOf(e: unknown): string {
  if (e instanceof HttpException) {
    const body = e.getResponse();
    if (typeof body === "string") return body;
    const text = (body as { message?: unknown }).message;
    if (typeof text === "string") return text;
    return e.message;
  }
  return "Couldn't forward to this chat. Try again.";
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeService,
    private readonly push: PushService,
  ) {}

  /**
   * Canonical, order-independent key for a 1:1 thread. Sorting means
   * `startDm(a, b)` and `startDm(b, a)` land on the same row, and the UNIQUE
   * index settles two requests racing to create it.
   */
  private dmKey(a: string, b: string) {
    return [a, b].sort().join(":");
  }

  async startDm(self: Member, otherId: string): Promise<string> {
    const selfId = self.id;
    if (selfId === otherId) throw new BadRequestException("You can't message yourself.");
    const [target] = await this.db
      .select({ id: user.id, canMessage: privacyAllows(selfId, user.id, "messaging") })
      .from(user)
      .where(and(eq(user.id, otherId), notBanned(user.id), notBlocking(user.id, selfId)))
      .limit(1);
    if (!target) throw new NotFoundException("Member not found.");

    const key = this.dmKey(selfId, otherId);
    const [existing] = await this.db
      .select({ id: conversation.id })
      .from(conversation)
      .where(eq(conversation.dmKey, key))
      .limit(1);
    // An existing thread always opens. Nobody has written in a new one yet, so
    // opening it with someone abroad takes Silver.
    if (!existing) {
      if (!target.canMessage) throw messagingDenied();
      await this.assertCanReach(self, otherId, null);
      if (newChatsPerDay(self) !== null) await this.assertCanOpenConversation(selfId);
    }

    // One transaction, so a thread can never exist without both members in it.
    // Re-adding the members on an existing thread is a no-op, and repairs one
    // left half-made by anything before this code.
    return this.db.transaction(async (tx) => {
      let id = existing?.id;
      if (!id) {
        const [created] = await tx
          .insert(conversation)
          .values({ kind: "dm", dmKey: key, createdBy: selfId })
          .onConflictDoNothing()
          .returning({ id: conversation.id });
        id =
          created?.id ??
          (
            await tx
              .select({ id: conversation.id })
              .from(conversation)
              .where(eq(conversation.dmKey, key))
              .limit(1)
          )[0]?.id;
      }
      if (!id) throw new InternalServerErrorException("Could not open the conversation.");
      await tx
        .insert(conversationParticipant)
        .values([
          { conversationId: id, userId: selfId },
          { conversationId: id, userId: otherId },
        ])
        .onConflictDoNothing();
      return id;
    });
  }

  private async assertCanOpenConversation(selfId: string) {
    const [row] = await this.db
      .select({ n: count() })
      .from(conversation)
      .where(
        and(
          eq(conversation.createdBy, selfId),
          gt(conversation.createdAt, sql`now() - interval '1 day'`),
          sql`not exists (select 1 from "message" as "opened_message" where "opened_message"."conversation_id" = ${conversation.id})`,
        ),
      );
    if (Number(row?.n ?? 0) >= MAX_EMPTY_CONVERSATIONS_PER_DAY) {
      throw new HttpException(
        "You've started a lot of new conversations today. Try again tomorrow.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Not a member and no such thread look the same from outside: both are 404. */
  async assertMember(conversationId: string, userId: string): Promise<void> {
    const [row] = await this.db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundException("Conversation not found.");
  }

  /**
   * The other member, if this one may write to them: still on Kinkord and not
   * blocking this member, which reads exactly like having left. A member who
   * did the blocking has to unblock first.
   */
  private async writablePeer(conversationId: string, userId: string): Promise<string> {
    const [peer] = await this.db
      .select({
        userId: conversationParticipant.userId,
        blockedByMe: blockedBy(userId, conversationParticipant.userId),
        canMessage: privacyAllows(userId, conversationParticipant.userId, "messaging"),
      })
      .from(conversationParticipant)
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          ne(conversationParticipant.userId, userId),
          notBanned(conversationParticipant.userId),
          notBlocking(conversationParticipant.userId, userId),
        ),
      )
      .limit(1);
    if (!peer) throw new BadRequestException("This member is no longer on Kinkord.");
    if (peer.blockedByMe) throw new ForbiddenException(YOU_BLOCKED);
    if (!peer.canMessage) throw messagingDenied();
    return peer.userId;
  }

  /**
   * Writing first to a member in another country is part of Silver; replies
   * are free, so it's allowed once the other member has written in the thread
   * (`conversationId` null: there's no thread yet). The super admins are exempt,
   * as from the daily allowance. A same-country chat costs one small query.
   */
  private async assertCanReach(
    who: Member,
    otherId: string,
    conversationId: string | null,
  ): Promise<string | null> {
    if (isSuperAdmin(who)) return null;
    const rows = await this.db
      .select({ userId: profile.userId, country: profile.country })
      .from(profile)
      .where(inArray(profile.userId, [who.id, otherId]));
    const countryOf = (id: string) => rows.find((r) => r.userId === id)?.country;
    const senderCountry = countryOf(who.id) ?? null;
    if (!differentCountries(senderCountry, countryOf(otherId))) return senderCountry;
    if (conversationId && (await this.peerHasWritten(conversationId, who.id))) return senderCountry;
    if (await hasSilver(this.db, who.id)) return senderCountry;
    throw new ForbiddenException({ code: CROSS_COUNTRY_PREMIUM, message: CROSS_COUNTRY_MESSAGE });
  }

  /** `forwardedFromId`: the message this is a forwarded copy of. */
  async sendMessage(
    sender: Member,
    conversationId: string,
    input: SendMessageInput,
    forwardedFromId?: string,
  ): Promise<MessageDto & { clientId: string | null }> {
    const senderId = sender.id;
    await this.assertMember(conversationId, senderId);
    const peerId = await this.writablePeer(conversationId, senderId);

    const [recent] = await this.db
      .select({ n: count() })
      .from(message)
      .where(
        and(
          eq(message.senderId, senderId),
          gt(message.createdAt, sql`now() - interval '1 minute'`),
        ),
      );
    if (Number(recent?.n ?? 0) >= MAX_MESSAGES_PER_MINUTE) {
      throw new HttpException(
        "You're sending messages too fast. Wait a moment.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (input.photoKey) {
      await this.assertPhotosAllowed(conversationId, senderId);
      await this.verifyPhoto(senderId, conversationId, input.photoKey);
    }
    // Writing first to someone abroad takes Silver. Checked before the
    // allowance, so a message refused here never uses it up.
    const senderCountry = await this.assertCanReach(sender, peerId, conversationId);

    const startsChat = newChatsPerDay(sender) !== null && !(await this.hasMessages(conversationId));
    const saved = startsChat
      ? await this.startChat(
          senderId,
          conversationId,
          input,
          await this.newChatLimit(sender, senderCountry),
          forwardedFromId,
        )
      : await this.insertMessage(this.db, senderId, conversationId, input, forwardedFromId);
    // Both members' open apps hear of it at once, the sender's other tabs too.
    void this.realtime.notify([peerId, senderId], { type: "message", conversationId });
    // And their phone, if the app isn't open on this thread, and their inbox.
    this.push.newMessage(senderId, peerId, conversationId, new Date(saved.createdAt));
    return saved;
  }

  /**
   * A first message starts a new chat, which the daily allowance counts. The
   * lock queues this member's first messages one at a time, so two sent at
   * once can't both slip in under the limit.
   */
  private startChat(
    senderId: string,
    conversationId: string,
    input: SendMessageInput,
    limit: number,
    forwardedFromId?: string,
  ): Promise<MessageDto & { clientId: string | null }> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`new-chat:${senderId}`}))`);
      const day = chatDay(new Date());
      if ((await this.chatsStartedSince(tx, senderId, day.start)) >= limit) {
        throw new HttpException(
          {
            code: NEW_CHAT_LIMIT,
            message:
              limit === 0
                ? "Starting new chats is part of Premium. You can always reply when someone messages you first."
                : "You've used today's new chats. You can message someone new after midnight.",
            resetsAt: day.end.toISOString(),
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return this.insertMessage(tx, senderId, conversationId, input, forwardedFromId);
    });
  }

  private async insertMessage(
    q: Queryable,
    senderId: string,
    conversationId: string,
    input: SendMessageInput,
    forwardedFromId?: string,
  ): Promise<MessageDto & { clientId: string | null }> {
    const [created] = await q
      .insert(message)
      .values({
        conversationId,
        senderId,
        body: input.body || null,
        ...(input.photoKey ? { photoKey: input.photoKey } : {}),
        ...(forwardedFromId ? { forwardedFromId } : {}),
      })
      .returning();
    // Keeps the list ordered by activity without a join on message.
    await q
      .update(conversation)
      .set({ lastMessageAt: created.createdAt })
      .where(eq(conversation.id, conversationId));
    return { ...(await this.toDto(created)), clientId: input.clientId ?? null };
  }

  private async hasMessages(conversationId: string): Promise<boolean> {
    const [first] = await this.db
      .select({ id: message.id })
      .from(message)
      .where(eq(message.conversationId, conversationId))
      .limit(1);
    return Boolean(first);
  }

  /**
   * Chats this member started since a moment: messages they sent that were
   * the first in their thread. Deleted ones still count, so deleting and
   * resending can't win a second chat.
   */
  private async chatsStartedSince(q: Queryable, userId: string, since: Date): Promise<number> {
    const [row] = await q
      .select({ n: count() })
      .from(message)
      .where(
        and(
          eq(message.senderId, userId),
          gte(message.createdAt, since),
          sql`not exists (select 1 from "message" as "earlier" where "earlier"."conversation_id" = ${message.conversationId} and ("earlier"."created_at", "earlier"."id") < (${message.createdAt}, ${message.id}))`,
        ),
      );
    return Number(row?.n ?? 0);
  }

  /** Today's new-chat allowance, so the app can say so before anyone types. */
  async allowance(who: Member): Promise<ChatAllowanceDto> {
    if (newChatsPerDay(who) === null) return { newChatsPerDay: null };
    const silver = await hasSilver(this.db, who.id);
    const country = silver ? null : await this.countryForAllowance(who.id);
    const day = chatDay(new Date());
    return {
      newChatsPerDay: newChatsPerDay(who, silver, country) ?? Number.POSITIVE_INFINITY,
      usedToday: await this.chatsStartedSince(this.db, who.id, day.start),
      resetsAt: day.end.toISOString(),
      silver,
    };
  }

  /** New chats a member with an allowance may start today: Silver raises it. */
  private async newChatLimit(who: Member, country: string | null): Promise<number> {
    return (
      newChatsPerDay(who, await hasSilver(this.db, who.id), country) ?? Number.POSITIVE_INFINITY
    );
  }

  private async countryForAllowance(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ country: profile.country })
      .from(profile)
      .where(eq(profile.userId, userId))
      .limit(1);
    return row?.country ?? null;
  }

  /**
   * A page of the thread, always oldest first. `before` walks back from a
   * message; `after` returns what arrived since one, which is how an open
   * thread polls. Positions compare in the database, where timestamps keep the
   * microseconds a JavaScript Date would drop.
   *
   * A message deleted for everyone stays in its place, without its text or
   * photo, so both members see that it was deleted. One this member deleted
   * for themselves is left out. `changedSince` adds messages edited or deleted
   * since then, wherever they are in the thread.
   */
  async history(
    userId: string,
    conversationId: string,
    opts: { before?: string; after?: string; changedSince?: string; limit: number },
  ): Promise<MessageDto[]> {
    await this.assertMember(conversationId, userId);
    const pivot = opts.before ?? opts.after;
    if (pivot) {
      const [known] = await this.db
        .select({ id: message.id })
        .from(message)
        .where(and(eq(message.id, pivot), eq(message.conversationId, conversationId)))
        .limit(1);
      if (!known) throw new BadRequestException("Unknown message.");
    }
    const conditions = [eq(message.conversationId, conversationId), notHiddenFor(userId)];
    if (opts.before) {
      conditions.push(sql`(${message.createdAt}, ${message.id}) < ${positionOf(opts.before)}`);
    }
    if (opts.after) {
      conditions.push(sql`(${message.createdAt}, ${message.id}) > ${positionOf(opts.after)}`);
    }
    const rows = await this.db
      .select()
      .from(message)
      .where(and(...conditions))
      .orderBy(
        ...(opts.after
          ? [asc(message.createdAt), asc(message.id)]
          : [desc(message.createdAt), desc(message.id)]),
      )
      .limit(opts.limit);
    const page = opts.after ? rows : rows.reverse();
    if (!opts.changedSince) return Promise.all(page.map((m) => this.toDto(m)));
    const changed = await this.db
      .select()
      .from(message)
      .where(
        and(
          eq(message.conversationId, conversationId),
          notHiddenFor(userId),
          // Only a message sent within the delete window can have changed
          // since: this keeps the poll on the thread's recent end.
          sql`${message.createdAt} > ${opts.changedSince}::timestamptz - (${sql.raw(String(DELETE_FOR_EVERYONE_HOURS))} * interval '1 hour')`,
          sql`${changedAt} > ${opts.changedSince}::timestamptz`,
        ),
      )
      .orderBy(asc(changedAt))
      .limit(CHANGES_PAGE);
    const byId = new Map([...page, ...changed].map((m) => [m.id, m]));
    const merged = [...byId.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    return Promise.all(merged.map((m) => this.toDto(m)));
  }

  /**
   * A message in a thread this member is in. Someone else's thread reads as no
   * such message: both are 404.
   */
  private async messageFor(userId: string, messageId: string): Promise<MessageRow> {
    const [row] = await this.db
      .select({ message })
      .from(message)
      .innerJoin(
        conversationParticipant,
        and(
          eq(conversationParticipant.conversationId, message.conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .where(eq(message.id, messageId))
      .limit(1);
    if (!row) throw new NotFoundException(MESSAGE_NOT_FOUND);
    return row.message;
  }

  /** Everyone in a thread: who hears that one of its messages changed. */
  private async membersOf(conversationId: string): Promise<string[]> {
    const rows = await this.db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.conversationId, conversationId));
    return rows.map((r) => r.userId);
  }

  /**
   * The sender changes a message's text, within a few minutes of sending it,
   * while they may still write to the other member. The text it replaces is
   * kept for the moderators. A forwarded copy keeps the words it was sent with.
   */
  async editMessage(userId: string, messageId: string, body: string): Promise<MessageDto> {
    const m = await this.messageFor(userId, messageId);
    if (m.senderId !== userId) throw new ForbiddenException(EDIT_NOT_YOURS);
    if (m.deletedAt) throw new BadRequestException(MESSAGE_DELETED);
    if (m.forwardedFromId) throw new BadRequestException(EDIT_FORWARDED);
    if (Date.now() - m.createdAt.getTime() > EDIT_WINDOW_MS) {
      throw new BadRequestException(EDIT_WINDOW_PASSED);
    }
    // A photo can lose its caption; a text message needs some text.
    if (!body && !m.photoKey) throw new BadRequestException("Write a message first.");
    if (body === (m.body ?? "")) return this.toDto(m);
    const peerId = await this.writablePeer(m.conversationId, userId);

    const [recent] = await this.db
      .select({ n: count() })
      .from(messageEdit)
      .where(
        and(
          eq(messageEdit.senderId, userId),
          gt(messageEdit.replacedAt, sql`now() - interval '1 minute'`),
        ),
      );
    if (Number(recent?.n ?? 0) >= MAX_MESSAGES_PER_MINUTE) {
      throw new HttpException(
        "You're editing messages too fast. Wait a moment.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // The row is locked while the old text is copied, so two edits at once
    // both keep what they replaced.
    const saved = await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ body: message.body, deletedAt: message.deletedAt })
        .from(message)
        .where(eq(message.id, m.id))
        .for("update");
      if (!current || current.deletedAt) return null;
      await tx
        .insert(messageEdit)
        .values({ messageId: m.id, senderId: userId, body: current.body });
      const [updated] = await tx
        .update(message)
        .set({ body: body || null, editedAt: sql`now()` })
        .where(eq(message.id, m.id))
        .returning();
      return updated ?? null;
    });
    if (!saved) throw new BadRequestException(MESSAGE_DELETED);
    void this.realtime.notify([peerId, userId], {
      type: "message",
      conversationId: m.conversationId,
    });
    return this.toDto(saved);
  }

  /**
   * "Delete for me" hides any message in the thread from this member only.
   * "Delete for everyone" is the sender's, within two days of sending: both
   * members see that it was deleted, and its text and photo stay only for the
   * moderators. Returns what the thread now shows in its place, if anything.
   */
  async deleteMessage(
    userId: string,
    messageId: string,
    scope: "me" | "everyone",
  ): Promise<{ message: MessageDto | null }> {
    const m = await this.messageFor(userId, messageId);
    if (scope === "me") {
      await this.db.insert(messageHidden).values({ userId, messageId: m.id }).onConflictDoNothing();
      // This member's other open tabs drop it too.
      void this.realtime.notify([userId], { type: "message", conversationId: m.conversationId });
      return { message: null };
    }
    if (m.senderId !== userId) throw new ForbiddenException(DELETE_NOT_YOURS);
    if (m.deletedAt) return { message: await this.toDto(m) };
    if (Date.now() - m.createdAt.getTime() > DELETE_WINDOW_MS) {
      throw new BadRequestException(DELETE_WINDOW_PASSED);
    }
    const [deleted] = await this.db
      .update(message)
      .set({ deletedAt: sql`now()` })
      .where(and(eq(message.id, m.id), isNull(message.deletedAt)))
      .returning();
    void this.realtime.notify(await this.membersOf(m.conversationId), {
      type: "message",
      conversationId: m.conversationId,
    });
    return { message: await this.toDto(deleted ?? { ...m, deletedAt: new Date() }) };
  }

  /**
   * Sends a copy of a message to other chats, marked as forwarded. Each copy
   * is an ordinary message there, so every rule for sending applies: the
   * daily allowance, Silver for someone abroad, photos only once open, and
   * the rate limit. One chat refusing doesn't stop the others.
   */
  async forwardMessage(
    sender: Member,
    messageId: string,
    conversationIds: string[],
  ): Promise<ForwardResultDto[]> {
    const m = await this.messageFor(sender.id, messageId);
    if (m.deletedAt) throw new BadRequestException(MESSAGE_DELETED);
    if (m.photoKey && m.senderId !== sender.id) {
      throw new ForbiddenException(FORWARD_PHOTO_NOT_YOURS);
    }
    const results: ForwardResultDto[] = [];
    // One at a time, so the allowance and the rate limit count each in turn.
    for (const conversationId of [...new Set(conversationIds)]) {
      try {
        const photoKey = m.photoKey
          ? await this.copyPhotoTo(sender.id, conversationId, m.photoKey)
          : undefined;
        const { clientId: _clientId, ...sent } = await this.sendMessage(
          sender,
          conversationId,
          { body: m.body ?? "", ...(photoKey ? { photoKey } : {}) },
          m.id,
        );
        results.push({ conversationId, message: sent, error: null });
      } catch (e) {
        // A refusal says why; anything else is ours to look into.
        if (!(e instanceof HttpException)) {
          this.logger.error(`forward ${m.id} to ${conversationId} failed`, e as Error);
        }
        results.push({ conversationId, message: null, error: refusalOf(e) });
      }
    }
    return results;
  }

  /**
   * The sender's own photo, copied under their prefix for the other thread:
   * the forwarded message passes the same checks as a photo sent there, and
   * deleting either message never touches the other's photo. Checked before
   * copying, so a chat that can't take photos costs nothing.
   */
  private async copyPhotoTo(senderId: string, conversationId: string, sourceKey: string) {
    await this.assertMember(conversationId, senderId);
    await this.writablePeer(conversationId, senderId);
    await this.assertPhotosAllowed(conversationId, senderId);
    const ext = sourceKey.slice(sourceKey.lastIndexOf(".") + 1);
    const key = `${photoPrefix(conversationId, senderId)}${randomUUID()}.${ext}`;
    await this.storage.copy(sourceKey, key);
    // A stored size that fails to copy is made from the original when the message is checked.
    await Promise.all(
      IMAGE_VARIANTS.map((v) =>
        this.storage.copy(variantKey(sourceKey, v), variantKey(key, v)).catch(() => undefined),
      ),
    );
    return key;
  }

  /** Ephemeral hints: throttled, authorised, published, never saved as messages. */
  private readonly typingSignals = new Map<string, { active: boolean; at: number }>();

  async setTyping(userId: string, conversationId: string, typing: boolean): Promise<void> {
    const key = `${userId}:${conversationId}`;
    const now = Date.now();
    const previous = this.typingSignals.get(key);
    if (previous) {
      const since = now - previous.at;
      // The same hint again only after a while, and a start at most once a second, so
      // flipping between the two can't flood the other member. A stop goes at once.
      if (previous.active === typing && since < TYPING_REPEAT_MS) return;
      if (typing && since < TYPING_MIN_GAP_MS) return;
    }
    // Claimed before any await, so requests sent all at once can't all get past the
    // checks above. A bounded cache limits repeated hints on this instance.
    if (this.typingSignals.size >= 5_000)
      this.typingSignals.delete(this.typingSignals.keys().next().value!);
    this.typingSignals.set(key, { active: typing, at: now });
    let peerId: string;
    try {
      // Access is checked on every hint we publish, even when a member was allowed earlier.
      await this.assertMember(conversationId, userId);
      peerId = await this.writablePeer(conversationId, userId);
    } catch (e) {
      // Nothing was sent: the slot goes back to how it was.
      if (previous) this.typingSignals.set(key, previous);
      else this.typingSignals.delete(key);
      throw e;
    }
    void this.realtime.notify([peerId], { type: "typing", conversationId, typing });
  }

  /**
   * Moves this member's read pointer forward to a message; never backwards.
   * Their inbox row for this chat clears with it.
   */
  async markRead(userId: string, conversationId: string, messageId: string): Promise<void> {
    await this.assertMember(conversationId, userId);
    const [known] = await this.db
      .select({ id: message.id, createdAt: message.createdAt })
      .from(message)
      .where(and(eq(message.id, messageId), eq(message.conversationId, conversationId)))
      .limit(1);
    if (!known) throw new BadRequestException("Unknown message.");
    const readAt = sql`(select "created_at" from "message" where "id" = ${messageId})`;
    const moved = await this.db
      .update(conversationParticipant)
      .set({ lastReadAt: readAt, lastReadMessageId: messageId })
      .where(
        and(
          eq(conversationParticipant.conversationId, conversationId),
          eq(conversationParticipant.userId, userId),
          sql`(${conversationParticipant.lastReadAt} is null or ${conversationParticipant.lastReadAt} < ${readAt})`,
        ),
      )
      .returning({ conversationId: conversationParticipant.conversationId });
    this.push.chatRead(userId, conversationId, known.createdAt);
    void this.realtime.notify([userId], { type: "message", conversationId });
    if (moved.length) void this.tellReceipt(conversationId, userId, true);
  }

  async markDelivered(userId: string, messageIds: string[]): Promise<void> {
    const moved = await this.db.execute<{ conversation_id: string }>(
      deliveryAckSql(userId, messageIds),
    );
    for (const row of moved?.rows ?? []) void this.tellReceipt(row.conversation_id, userId, false);
  }

  /**
   * Tells the chat's other members that their messages were delivered or seen, so the
   * ticks move without polling. A read is told only to someone who may see this member's
   * read receipts; that setting works both ways, so it reads the same from either side.
   */
  private async tellReceipt(conversationId: string, userId: string, read: boolean) {
    try {
      const peers = await this.db
        .select({ userId: conversationParticipant.userId })
        .from(conversationParticipant)
        .where(
          and(
            eq(conversationParticipant.conversationId, conversationId),
            ne(conversationParticipant.userId, userId),
            read
              ? privacyAllows(userId, conversationParticipant.userId, "readReceipts")
              : undefined,
          ),
        );
      if (peers.length)
        await this.realtime.notify(
          peers.map((p) => p.userId),
          { type: "receipt", conversationId },
        );
    } catch {
      // The ticks still move on the sender's next refresh.
    }
  }

  /** Seeing the inbox does not read any conversation. */
  async unreadCount(userId: string): Promise<{ count: number }> {
    const [row] = await this.db
      .select({ total: messageBadgeCount(userId) })
      .from(user)
      .where(eq(user.id, userId));
    return { count: Number(row?.total ?? 0) };
  }

  async seeInbox(userId: string): Promise<{ ok: true }> {
    const seenAt = new Date();
    await this.db
      .insert(chatInboxSeen)
      .values({ userId, seenAt })
      .onConflictDoUpdate({
        target: chatInboxSeen.userId,
        set: { seenAt: sql`greatest(${chatInboxSeen.seenAt}, excluded.seen_at)` },
      });
    void this.realtime.notify([userId], { type: "inbox_seen" });
    return { ok: true };
  }

  /**
   * The inbox. Threads whose other member was suspended or deleted are left
   * out: they can't be answered, and a block should read as gone. A thread
   * nobody has written in yet belongs to whoever opened it: the other member
   * first hears of it with the first message, which the daily allowance counts.
   */
  async listConversations(
    userId: string,
    query = "",
    filter: InboxFilter = "all",
  ): Promise<ConversationSummaryDto[]> {
    const rows = await this.summaries(userId, null, this.inbox(userId, query.trim(), filter));
    return rows
      .filter(
        ({ summary, openedBy }) =>
          summary.peer !== null && (summary.lastMessage !== null || openedBy === userId),
      )
      .map((r) => r.summary);
  }

  /**
   * One thread's header: who it's with, whether they're around, and whether
   * the composer may offer photos. A last message from the other member
   * already answers that, without another query.
   */
  async conversation(userId: string, conversationId: string): Promise<ConversationThreadDto> {
    await this.assertMember(conversationId, userId);
    const [row] = await this.summaries(userId, conversationId);
    if (!row) throw new NotFoundException("Conversation not found.");
    const { peer, lastMessage } = row.summary;
    const canSendPhotos =
      peer !== null &&
      !peer.blockedByMe &&
      peer.canMessage &&
      ((lastMessage !== null && lastMessage.senderId !== userId) ||
        (await this.peerHasWritten(conversationId, userId)));
    return { ...row.summary, canSendPhotos };
  }

  /**
   * The chats a member's inbox shows, as SQL, so the tabs, the search and the
   * counts all apply before the page limit rather than to the latest page only.
   * The other member is still here (not suspended, not blocking them), and the
   * thread has been written in or was opened by this member.
   */
  private inbox(userId: string, query: string, filter: InboxFilter): SQL {
    return and(
      exists(
        this.db
          .select({ one: sql`1` })
          .from(inboxPeer)
          .where(
            and(
              eq(inboxPeer.conversationId, conversation.id),
              ne(inboxPeer.userId, userId),
              notBanned(inboxPeer.userId),
              notBlocking(inboxPeer.userId, userId),
            ),
          ),
      ),
      or(
        eq(conversation.createdBy, userId),
        exists(
          this.db
            .select({ one: sql`1` })
            .from(inboxMessage)
            .where(
              and(eq(inboxMessage.conversationId, conversation.id), isNull(inboxMessage.deletedAt)),
            ),
        ),
      ),
      query ? this.matching(userId, containsPattern(query)) : undefined,
      filter === "unread" ? this.unread(userId) : undefined,
      filter === "online" ? this.peerOnline(userId) : undefined,
    )!;
  }

  /** Written by the other member after this member's read pointer. */
  private unread(userId: string): SQL {
    return exists(
      this.db
        .select({ one: sql`1` })
        .from(inboxMessage)
        .where(
          and(
            eq(inboxMessage.conversationId, conversation.id),
            isNull(inboxMessage.deletedAt),
            ne(inboxMessage.senderId, userId),
            sql`${inboxMessage.createdAt} > coalesce(${conversationParticipant.lastReadAt}, 'epoch')`,
          ),
        ),
    );
  }

  /** The other member was around in the last few minutes, as presence counts online. */
  private peerOnline(userId: string): SQL {
    return exists(
      this.db
        .select({ one: sql`1` })
        .from(inboxPeer)
        .innerJoin(inboxPeerProfile, eq(inboxPeerProfile.userId, inboxPeer.userId))
        .where(
          and(
            eq(inboxPeer.conversationId, conversation.id),
            ne(inboxPeer.userId, userId),
            privacyAllows(userId, inboxPeer.userId, "onlineStatus"),
            sql`${inboxPeerProfile.lastSeenAt} > timezone('UTC', now()) - (${sql.raw(String(ONLINE_WINDOW_SECONDS))} * interval '1 second')`,
          ),
        ),
    );
  }

  /** How many chats each inbox tab holds, every chat counted, for the search in force. */
  async inboxCounts(userId: string, query = ""): Promise<InboxCountsDto> {
    const [row] = await this.db
      .select({
        all: count(),
        unread: sql<number>`count(*) filter (where ${this.unread(userId)})`,
        online: sql<number>`count(*) filter (where ${this.peerOnline(userId)})`,
      })
      .from(conversationParticipant)
      .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
      .where(
        and(eq(conversationParticipant.userId, userId), this.inbox(userId, query.trim(), "all")),
      );
    return {
      all: Number(row?.all ?? 0),
      unread: Number(row?.unread ?? 0),
      online: Number(row?.online ?? 0),
    };
  }

  /**
   * The inbox search, across every chat rather than the latest page: the other
   * member's name as the inbox shows it or username, or any message still in the chat.
   */
  private matching(userId: string, pattern: string) {
    return or(
      exists(
        this.db
          .select({ one: sql`1` })
          .from(searchParticipant)
          .innerJoin(searchUser, eq(searchUser.id, searchParticipant.userId))
          .leftJoin(searchProfile, eq(searchProfile.userId, searchParticipant.userId))
          .where(
            and(
              eq(searchParticipant.conversationId, conversation.id),
              ne(searchParticipant.userId, userId),
              // Only what the inbox shows of them: the account name stays private
              // once they've a display name or username, so it mustn't be searchable.
              or(
                ilike(searchProfile.displayName, pattern),
                ilike(searchUser.username, pattern),
                and(
                  isNull(searchProfile.displayName),
                  isNull(searchUser.username),
                  ilike(searchUser.name, pattern),
                ),
              ),
            ),
          ),
      ),
      exists(
        this.db
          .select({ one: sql`1` })
          .from(searchMessage)
          .where(
            and(
              eq(searchMessage.conversationId, conversation.id),
              isNull(searchMessage.deletedAt),
              notHiddenFor(userId, searchMessage.id),
              ilike(searchMessage.body, pattern),
            ),
          ),
      ),
    );
  }

  /** A fixed handful of queries however many threads there are, not one per row. */
  private async summaries(
    userId: string,
    only: string | null,
    inbox?: SQL,
  ): Promise<Array<{ summary: ConversationSummaryDto; openedBy: string | null }>> {
    const mine = await this.db
      .select({
        id: conversation.id,
        kind: conversation.kind,
        lastMessageAt: conversation.lastMessageAt,
        createdBy: conversation.createdBy,
      })
      .from(conversationParticipant)
      .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
      .where(
        and(
          eq(conversationParticipant.userId, userId),
          only ? eq(conversation.id, only) : undefined,
          inbox,
        ),
      )
      .orderBy(desc(conversation.lastMessageAt))
      .limit(LIST_LIMIT);
    if (mine.length === 0) return [];
    const ids = mine.map((c) => c.id);

    const peers = await this.db
      .select({
        conversationId: conversationParticipant.conversationId,
        userId: conversationParticipant.userId,
        username: user.username,
        name: user.name,
        displayName: profile.displayName,
        avatarKey: privateProfileValue(userId, profile.userId, "profilePhoto", profile.avatarKey),
        lastSeenAt: privateProfileValue(userId, profile.userId, "onlineStatus", profile.lastSeenAt),
        blockedByMe: blockedBy(userId, conversationParticipant.userId),
        canMessage: privacyAllows(userId, conversationParticipant.userId, "messaging"),
        silver: silverCheck(conversationParticipant.userId),
        teamMember: teamBadge(conversationParticipant.userId),
        deliveredAt:
          sql<Date | null>`greatest(${conversationParticipant.lastDeliveredAt}, ${conversationParticipant.lastReadAt})`.mapWith(
            conversationParticipant.lastReadAt,
          ),
        readAt: privateProfileValue(
          userId,
          conversationParticipant.userId,
          "readReceipts",
          conversationParticipant.lastReadAt,
        ),
      })
      .from(conversationParticipant)
      .innerJoin(user, eq(user.id, conversationParticipant.userId))
      .leftJoin(profile, eq(profile.userId, conversationParticipant.userId))
      .where(
        and(
          inArray(conversationParticipant.conversationId, ids),
          ne(conversationParticipant.userId, userId),
          notBanned(conversationParticipant.userId),
          // Someone who blocked this member is gone from their inbox.
          notBlocking(conversationParticipant.userId, userId),
        ),
      );

    const lastRows = await this.db
      .selectDistinctOn([message.conversationId])
      .from(message)
      .where(
        and(inArray(message.conversationId, ids), isNull(message.deletedAt), notHiddenFor(userId)),
      )
      .orderBy(message.conversationId, desc(message.createdAt), desc(message.id));

    // Unread: written by someone else after my read pointer.
    const unreadRows = await this.db
      .select({ conversationId: message.conversationId, unread: count() })
      .from(message)
      .innerJoin(
        conversationParticipant,
        and(
          eq(conversationParticipant.conversationId, message.conversationId),
          eq(conversationParticipant.userId, userId),
        ),
      )
      .where(
        and(
          inArray(message.conversationId, ids),
          isNull(message.deletedAt),
          ne(message.senderId, userId),
          sql`${message.createdAt} > coalesce(${conversationParticipant.lastReadAt}, 'epoch')`,
        ),
      )
      .groupBy(message.conversationId);

    const peerByConv = new Map<string, ChatPeerDto>(
      await Promise.all(
        peers.map(
          async (p) =>
            [
              p.conversationId,
              {
                userId: p.userId,
                username: p.username,
                displayName: p.displayName ?? p.username ?? p.name,
                avatarUrl: p.avatarKey
                  ? await this.storage.presignDownload(p.avatarKey, "sm")
                  : null,
                silver: Boolean(p.silver),
                teamMember: Boolean(p.teamMember),
                online: PresenceService.isOnline(p.lastSeenAt),
                presence: PresenceService.status(p.lastSeenAt),
                blockedByMe: Boolean(p.blockedByMe),
                canMessage: Boolean(p.canMessage),
              },
            ] as const,
        ),
      ),
    );
    const lastByConv = new Map(
      await Promise.all(
        lastRows.map(async (m) => [m.conversationId, await this.toDto(m)] as const),
      ),
    );
    const unreadByConv = new Map(unreadRows.map((u) => [u.conversationId, Number(u.unread)]));

    return mine.map((c) => ({
      summary: {
        id: c.id,
        kind: c.kind,
        lastMessageAt: c.lastMessageAt.toISOString(),
        peer: peerByConv.get(c.id) ?? null,
        lastMessage: lastByConv.get(c.id) ?? null,
        unreadCount: unreadByConv.get(c.id) ?? 0,
        receipts: {
          deliveredAt:
            peers.find((p) => p.conversationId === c.id)?.deliveredAt?.toISOString() ?? null,
          readAt: peers.find((p) => p.conversationId === c.id)?.readAt?.toISOString() ?? null,
        },
      },
      openedBy: c.createdBy,
    }));
  }

  /**
   * A slot to upload one photo into before sending it: the original, plus a
   * slot per stored size, as for a post photo. Only a member of the thread
   * gets one, and only once photos are open there.
   */
  async presignPhotoUpload(
    userId: string,
    conversationId: string,
    contentType: string,
    contentLength?: number,
  ) {
    await this.assertMember(conversationId, userId);
    await this.writablePeer(conversationId, userId);
    await this.assertPhotosAllowed(conversationId, userId);
    const ext = PHOTO_TYPES[contentType];
    if (!ext) throw new BadRequestException(photoTypes());
    if (contentLength !== undefined && contentLength > photoMaxBytes) {
      throw new BadRequestException(photoTooLarge());
    }
    const key = `${photoPrefix(conversationId, userId)}${randomUUID()}.${ext}`;
    const [uploadUrl, ...variantUrls] = await Promise.all([
      this.storage.presignUpload(key, contentType, contentLength),
      ...IMAGE_VARIANTS.map((v) => this.storage.presignUpload(variantKey(key, v), contentType)),
    ]);
    const variantUploadUrls = Object.fromEntries(
      IMAGE_VARIANTS.map((v, i) => [v, variantUrls[i]]),
    ) as Record<ImageVariant, string>;
    return {
      key,
      uploadUrl,
      variantUploadUrls,
      expiresInSeconds: 600,
      maxSizeMb: CHAT_PHOTO_MAX_MB,
    };
  }

  /** Whether the other member has written in this thread. */
  private async peerHasWritten(conversationId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: message.id })
      .from(message)
      .where(and(eq(message.conversationId, conversationId), ne(message.senderId, userId)))
      .limit(1);
    return Boolean(row);
  }

  /**
   * Photos open up once the other member has written in the thread, so nobody
   * gets a photo from someone they've never answered.
   */
  private async assertPhotosAllowed(conversationId: string, userId: string): Promise<void> {
    if (!(await this.peerHasWritten(conversationId, userId))) {
      throw new ForbiddenException(PHOTOS_LOCKED);
    }
  }

  /**
   * A key only becomes a message's photo once S3 confirms the upload exists,
   * sits under the sender's own prefix for this thread, and is an allowed
   * image within the size cap. The prefix check is the important one: without
   * it a member could attach, and so get a link to, somebody else's photo.
   */
  private async verifyPhoto(senderId: string, conversationId: string, key: string) {
    if (!key.startsWith(photoPrefix(conversationId, senderId))) {
      throw new BadRequestException("photo: unknown upload");
    }
    const info = await this.storage.describe(key);
    if (!info) throw new BadRequestException("photo: upload not found");
    if (info.size > photoMaxBytes) {
      await this.storage.remove(key);
      throw new BadRequestException(photoTooLarge());
    }
    if (!info.contentType || !PHOTO_TYPES[info.contentType]) {
      await this.storage.remove(key);
      throw new BadRequestException(photoTypes());
    }
    // An upload missing a stored size gets it by copy, so the thread never
    // asks for an object that isn't there.
    await Promise.all(
      IMAGE_VARIANTS.map(async (v) => {
        const target = variantKey(key, v);
        if (!(await this.storage.describe(target))) await this.storage.copy(key, target);
      }),
    );
  }

  /** A message deleted for everyone keeps only its place: no text, no photo. */
  private async toDto(m: MessageRow): Promise<MessageDto> {
    const deleted = Boolean(m.deletedAt);
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: deleted ? "" : (m.body ?? ""),
      photo: !deleted && m.photoKey ? await this.photoLinks(m.photoKey) : null,
      createdAt: m.createdAt.toISOString(),
      editedAt: deleted ? null : (m.editedAt?.toISOString() ?? null),
      deletedAt: m.deletedAt?.toISOString() ?? null,
      forwarded: !deleted && Boolean(m.forwardedFromId),
    };
  }

  /** Links to every size the thread shows; signed per hour, so the browser caches them. */
  private async photoLinks(key: string): Promise<ChatPhotoDto> {
    const [previewUrl, thumbUrl, url] = await Promise.all([
      this.storage.presignDownload(key, "sm"),
      this.storage.presignDownload(key, "md"),
      this.storage.presignDownload(key),
    ]);
    return { previewUrl, thumbUrl, url };
  }
}
