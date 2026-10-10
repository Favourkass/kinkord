import { describe, it, expect, vi } from "vitest";
import { WalletGiftsService, giftFromEarned, giftHistoryDto } from "./wallet-gifts.service";
import type { Db } from "../db/db.module";
import type { PostsService } from "../posts/posts.service";
import { walletGiftSchema } from "./dto";
const input = {
  postId: "11111111-1111-4111-8111-111111111111",
  currency: "coin" as const,
  quantity: 5,
  requestKey: "22222222-2222-4222-8222-222222222222",
  senderId: "a",
};
const gift = {
  id: "g",
  senderId: "a",
  recipientId: "b",
  senderName: "Alice",
  recipientName: "Bob",
  ...input,
  createdAt: new Date("2026-10-08T12:00:00Z"),
};
function fixture({
  selects = [
    [],
    [{ enabled: 1 }],
    [{ authorId: "b", repostOfId: null }],
    [{ available: 10, earned: 0 }],
    [{ displayName: "Alice" }],
    [{ displayName: "Bob" }],
  ],
  debit = [{}],
  credit = [{}],
  visible = { author: { userId: "b" } },
}: { selects?: unknown[][]; debit?: unknown[]; credit?: unknown[]; visible?: unknown } = {}) {
  const values: unknown[] = [];
  const chain = (rows: unknown[]) => {
    const q: Record<string, unknown> = {
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    };
    for (const name of ["from", "where", "for", "set", "onConflictDoUpdate", "returning"])
      q[name] = () => q;
    q.values = (v: unknown) => {
      values.push(v);
      return q;
    };
    return q;
  };
  const inserts = [credit, [gift]];
  const db = {
    select: vi.fn(() => chain(selects.shift() ?? [])),
    update: vi.fn(() => chain(debit)),
    insert: vi.fn(() => chain(inserts.shift() ?? [])),
    execute: vi.fn(async () => []),
    transaction: vi.fn(),
  };
  db.transaction.mockImplementation(async (cb) => cb(db));
  const posts = { byId: vi.fn(async () => visible) };
  const service = new WalletGiftsService(db as unknown as Db, posts as unknown as PostsService);
  vi.spyOn(service, "canReceive").mockResolvedValue(true);
  return {
    service,
    db,
    posts,
    values,
  };
}
describe("post wallet gifts", () => {
  it("validates currency, whole positive quantity and retry/post identifiers", () => {
    for (const patch of [
      { quantity: 0 },
      { quantity: -1 },
      { quantity: 1.5 },
      { quantity: 1000001 },
      { currency: "cash" },
      { postId: "x" },
      { requestKey: "x" },
    ])
      expect(walletGiftSchema.safeParse({ ...input, ...patch }).success).toBe(false);
  });
  it("debits sender, credits the original author and writes one balanced transfer", async () => {
    const { service, db, values } = fixture();
    const result = await service.send("a", input);
    expect(db.update).toHaveBeenCalledTimes(1);
    expect(db.insert).toHaveBeenCalledTimes(2);
    // Received as a gift, so the author can withdraw it.
    expect(values[0]).toMatchObject({
      userId: "b",
      currency: "coin",
      available: 5,
      reserved: 0,
      earned: 5,
    });
    expect(values[1]).toMatchObject({
      senderId: "a",
      recipientId: "b",
      quantity: 5,
      senderEarned: 0,
      postId: input.postId,
    });
    expect(result).toMatchObject({ kind: "gift_sent", counterpartyName: "Bob" });
  });
  it("refuses a gift sent as someone other than who is signed in, before anything is read", async () => {
    const { service, db, posts } = fixture();
    await expect(service.send("b", input)).rejects.toMatchObject({
      response: { code: "WRONG_ACCOUNT" },
    });
    expect(posts.byId).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
  });
  it("checks visibility once, before the transaction holds a connection", async () => {
    const { service, posts } = fixture();
    await service.send("a", input);
    expect(posts.byId).toHaveBeenCalledTimes(1);
  });
  it("replays a retry without touching either balance", async () => {
    const { service, db } = fixture({ selects: [[gift]] });
    await service.send("a", input);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("rejects a retry key with different contents", async () => {
    const { service, db } = fixture({ selects: [[gift]] });
    await expect(service.send("a", { ...input, quantity: 6 })).rejects.toThrow(/another gift/);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("spends the sender's bought coins first, and gift earnings only for the rest", async () => {
    const { service, values } = fixture({
      selects: [
        [],
        [{ enabled: 1 }],
        [{ authorId: "b", repostOfId: null }],
        [{ available: 10, earned: 8 }],
        [{ displayName: "Alice" }],
        [{ displayName: "Bob" }],
      ],
    });
    await service.send("a", input);
    // 2 bought coins cover part of the 5; the other 3 come out of earnings.
    expect(values[1]).toMatchObject({ quantity: 5, senderEarned: 3 });
  });
  it("refuses a gift bigger than the sender's balance before touching it", async () => {
    const { service, db } = fixture({
      selects: [
        [],
        [{ enabled: 1 }],
        [{ authorId: "b", repostOfId: null }],
        [{ available: 3, earned: 0 }],
      ],
    });
    await expect(service.send("a", input)).rejects.toThrow(/Insufficient/);
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("refuses overspending before crediting the author", async () => {
    const { service, db } = fixture({ debit: [] });
    await expect(service.send("a", input)).rejects.toThrow(/Insufficient/);
    expect(db.insert).not.toHaveBeenCalled();
  });
  it("fails the transaction if the recipient balance would overflow", async () => {
    const { service } = fixture({ credit: [] });
    await expect(service.send("a", input)).rejects.toThrow(/cannot receive/);
  });
  it("rejects missing/inaccessible posts and self gifts before balance access", async () => {
    for (const visible of [null, { author: { userId: "a" } }]) {
      const { service, db } = fixture({ visible, selects: [[]] });
      await expect(service.send("a", input)).rejects.toThrow();
      expect(db.update).not.toHaveBeenCalled();
    }
  });
  it("respects the wallet transaction switch", async () => {
    const { service, db } = fixture({ selects: [[], [{ enabled: 0 }]] });
    await expect(service.send("a", input)).rejects.toMatchObject({
      response: { code: "WALLET_DISABLED", message: "Wallet transactions are not enabled yet." },
    });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("rejects posts deleted or changed before transfer", async () => {
    const { service, db } = fixture({ selects: [[], [{ enabled: 1 }], []] });
    await expect(service.send("a", input)).rejects.toThrow(/original post/);
    expect(db.update).not.toHaveBeenCalled();
  });
  it("shows the same transfer as sent/received in each member's history", () => {
    expect(giftHistoryDto(gift, "a")).toMatchObject({
      kind: "gift_sent",
      counterpartyName: "Bob",
      quantity: 5,
    });
    expect(giftHistoryDto(gift, "b")).toMatchObject({
      kind: "gift_received",
      counterpartyName: "Alice",
      quantity: 5,
    });
  });
});

it("returns a delivered gift after its post becomes inaccessible", async () => {
  const { service, db } = fixture({ visible: null, selects: [[gift]] });
  expect(await service.send("a", input)).toMatchObject({ id: "g", kind: "gift_sent" });
  expect(db.update).not.toHaveBeenCalled();
});

it("rejects gifting to a Basic or expired subscriber before moving funds", async () => {
  const { service, db } = fixture();
  vi.mocked(service.canReceive).mockResolvedValue(false);
  await expect(service.send("a", input)).rejects.toThrow(/active Silver/);
  expect(db.update).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
});

describe("giftFromEarned", () => {
  it("takes gift earnings only for what bought coins can't cover", () => {
    expect(giftFromEarned({ available: 10, earned: 0 }, 5)).toBe(0);
    expect(giftFromEarned({ available: 10, earned: 8 }, 5)).toBe(3);
    expect(giftFromEarned({ available: 10, earned: 10 }, 5)).toBe(5);
  });
});
