import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import type { z } from "zod";
import { DRIZZLE, type Db } from "../db/db.module";
import { post, profile, walletBalance, walletGift, walletSettings } from "../db/schema";
import { PostsService } from "../posts/posts.service";
import { hasSilver } from "../subscriptions/plans";
import { walletGiftSchema } from "./dto";
import { sameSender } from "./rules";

type Gift = typeof walletGift.$inferSelect;

/**
 * How much of a gift comes out of the sender's gift earnings: bought coins are
 * spent first, so only what they can't cover.
 */
export function giftFromEarned(
  balance: { available: number; earned: number },
  quantity: number,
): number {
  return Math.max(0, quantity - (balance.available - balance.earned));
}
export function giftHistoryDto(row: Gift, viewerId: string) {
  const sent = row.senderId === viewerId;
  return {
    id: row.id,
    userId: viewerId,
    kind: sent ? ("gift_sent" as const) : ("gift_received" as const),
    currency: row.currency,
    quantity: row.quantity,
    amountKobo: 0,
    status: "paid" as const,
    reference: `GIFT-${row.id.toUpperCase()}`,
    postId: row.postId,
    counterpartyName: sent ? row.recipientName : row.senderName,
    bankName: "",
    accountName: "",
    accountNumber: "",
    receiptKey: null,
    senderReference: null,
    senderAccountName: null,
    reviewNote: null,
    settlementReference: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.createdAt.toISOString(),
  };
}
@Injectable()
export class WalletGiftsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly posts: PostsService,
  ) {}
  async canReceive(userId: string, db: Db = this.db) {
    return hasSilver(db, userId);
  }
  async send(senderId: string, raw: z.infer<typeof walletGiftSchema>) {
    const input = walletGiftSchema.parse(raw);
    sameSender(senderId, input.senderId);
    const visible = await this.posts.byId(input.postId, senderId);
    if (!visible) {
      // A lost response may be retried after the author deletes or hides the post.
      const [delivered] = await this.db
        .select()
        .from(walletGift)
        .where(and(eq(walletGift.senderId, senderId), eq(walletGift.requestKey, input.requestKey)));
      if (delivered) {
        if (
          delivered.postId !== input.postId ||
          delivered.currency !== input.currency ||
          delivered.quantity !== input.quantity
        )
          throw new ConflictException("Request key already used for another gift.");
        return giftHistoryDto(delivered, senderId);
      }
      throw new NotFoundException("This post is no longer available.");
    }
    const recipientId = visible.author.userId;
    if (recipientId === senderId)
      throw new BadRequestException("You cannot send a gift to yourself.");
    const result = await this.db.transaction(async (tx) => {
      // Use the same wallet locks as purchases/withdrawals, ordered to avoid reciprocal-gift deadlocks.
      for (const id of [senderId, recipientId].sort())
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"wallet:" + id}))`);
      const [existing] = await tx
        .select()
        .from(walletGift)
        .where(and(eq(walletGift.senderId, senderId), eq(walletGift.requestKey, input.requestKey)));
      if (existing) {
        if (
          existing.postId !== input.postId ||
          existing.currency !== input.currency ||
          existing.quantity !== input.quantity
        )
          throw new ConflictException("Request key already used for another gift.");
        return existing;
      }
      const [config] = await tx
        .select()
        .from(walletSettings)
        .where(eq(walletSettings.id, 1))
        .for("share");
      if (!config?.enabled)
        throw new ServiceUnavailableException("Wallet transactions are not enabled yet.");
      const [target] = await tx
        .select()
        .from(post)
        .where(and(eq(post.id, input.postId), isNull(post.deletedAt)))
        .for("share");
      if (!target || target.authorId !== recipientId || target.repostOfId)
        throw new NotFoundException("Choose the original post to send a gift.");
      // Visibility was checked before the transaction, and the share lock above keeps the post
      // from being deleted or changed until the gift lands. Checking again here would take a
      // second pool connection while this one waits: enough gifts at once would exhaust the pool.
      if (!(await this.canReceive(recipientId, tx as unknown as Db)))
        throw new ForbiddenException(
          "Only members with an active Silver subscription can receive gifts.",
        );
      const insufficient = () =>
        new ConflictException("Insufficient available balance. Buy more or choose a smaller gift.");
      const [from] = await tx
        .select()
        .from(walletBalance)
        .where(and(eq(walletBalance.userId, senderId), eq(walletBalance.currency, input.currency)));
      if (!from || from.available < input.quantity) throw insufficient();
      // Bought coins go first, so a gift spends the sender's gift earnings (all they can
      // withdraw) only once the bought ones run out.
      const senderEarned = giftFromEarned(from, input.quantity);
      const debited = await tx
        .update(walletBalance)
        .set({
          available: sql`${walletBalance.available} - ${input.quantity}`,
          earned: sql`${walletBalance.earned} - ${senderEarned}`,
        })
        .where(
          and(
            eq(walletBalance.userId, senderId),
            eq(walletBalance.currency, input.currency),
            gte(walletBalance.available, input.quantity),
            gte(walletBalance.earned, senderEarned),
          ),
        )
        .returning();
      if (!debited.length) throw insufficient();
      // Received as a gift: the recipient can withdraw it.
      const credited = await tx
        .insert(walletBalance)
        .values({
          userId: recipientId,
          currency: input.currency,
          available: input.quantity,
          reserved: 0,
          earned: input.quantity,
        })
        .onConflictDoUpdate({
          target: [walletBalance.userId, walletBalance.currency],
          set: {
            available: sql`${walletBalance.available} + ${input.quantity}`,
            earned: sql`${walletBalance.earned} + ${input.quantity}`,
          },
          setWhere: sql`${walletBalance.available} <= ${2147483647 - input.quantity}`,
        })
        .returning();
      if (!credited.length)
        throw new ConflictException("The recipient's wallet cannot receive this amount.");
      const [sender] = await tx.select().from(profile).where(eq(profile.userId, senderId));
      const [recipient] = await tx.select().from(profile).where(eq(profile.userId, recipientId));
      const [gift] = await tx
        .insert(walletGift)
        .values({
          senderId,
          recipientId,
          postId: input.postId,
          currency: input.currency,
          quantity: input.quantity,
          senderEarned,
          requestKey: input.requestKey,
          senderName: sender?.displayName ?? "Member",
          recipientName: recipient?.displayName ?? "Member",
        })
        .returning();
      return gift;
    });
    return giftHistoryDto(result, senderId);
  }
}
