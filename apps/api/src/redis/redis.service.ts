import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client!: RedisClientType;
  public pub!: RedisClientType;
  public sub!: RedisClientType;

  async onModuleInit() {
    const url = process.env.REDIS_URL!;
    this.client = createClient({ url });
    this.pub = createClient({ url });
    this.sub = createClient({ url });
    await Promise.all([this.client.connect(), this.pub.connect(), this.sub.connect()]);
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.client?.quit(), this.pub?.quit(), this.sub?.quit()]);
  }

  // ----- Presence -----
  private presenceKey(userId: string) { return `presence:user:${userId}`; }
  private readonly onlineSetKey = 'presence:online';

  async addSocket(userId: string, socketId: string) {
    const key = this.presenceKey(userId);
    const wasOffline = (await this.client.sCard(key)) === 0;
    await this.client.sAdd(key, socketId);
    await this.client.sAdd(this.onlineSetKey, userId);
    return { becameOnline: wasOffline };
  }

  async removeSocket(userId: string, socketId: string) {
    const key = this.presenceKey(userId);
    await this.client.sRem(key, socketId);
    const remaining = await this.client.sCard(key);
    if (remaining === 0) {
      await this.client.del(key);
      await this.client.sRem(this.onlineSetKey, userId);
      return { becameOffline: true };
    }
    return { becameOffline: false };
  }

  async isOnline(userId: string) {
    return (await this.client.sCard(this.presenceKey(userId))) > 0;
  }

  async onlineUsers(): Promise<string[]> {
    return this.client.sMembers(this.onlineSetKey);
  }

  // ----- Unread -----
  private unreadKey(userId: string) { return `unread:${userId}`; }

  async bumpUnread(userId: string, conversationId: string, by = 1) {
    return this.client.hIncrBy(this.unreadKey(userId), conversationId, by);
  }
  async clearUnread(userId: string, conversationId: string) {
    await this.client.hDel(this.unreadKey(userId), conversationId);
  }
  async unreadSnapshot(userId: string): Promise<Record<string, number>> {
    const raw = await this.client.hGetAll(this.unreadKey(userId));
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) out[k] = Number(v);
    return out;
  }
  async setUnread(userId: string, conversationId: string, count: number) {
    if (count <= 0) return this.client.hDel(this.unreadKey(userId), conversationId);
    await this.client.hSet(this.unreadKey(userId), conversationId, count);
  }
}