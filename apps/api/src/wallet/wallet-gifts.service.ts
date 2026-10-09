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

type Gift = typeof walletGift.$inferSelect;
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
      if (!(await this.posts.byId(input.postId, senderId)))
        throw new NotFoundException("This post is no longer available.");
      if (!(await this.canReceive(recipientId, tx as unknown as Db)))
        throw new ForbiddenException(
          "Only members with an active Silver subscription can receive gifts.",
        );
      const debited = await tx
        .update(walletBalance)
        .set({ available: sql`${walletBalance.available} - ${input.quantity}` })
        .where(
          and(
            eq(walletBalance.userId, senderId),
            eq(walletBalance.currency, input.currency),
            gte(walletBalance.available, input.quantity),
          ),
        )
        .returning();
      if (!debited.length)
        throw new ConflictException(
          "Insufficient available balance. Buy more or choose a smaller gift.",
        );
      const credited = await tx
        .insert(walletBalance)
        .values({
          userId: recipientId,
          currency: input.currency,
          available: input.quantity,
          reserved: 0,
        })
        .onConflictDoUpdate({
          target: [walletBalance.userId, walletBalance.currency],
          set: { available: sql`${walletBalance.available} + ${input.quantity}` },
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
