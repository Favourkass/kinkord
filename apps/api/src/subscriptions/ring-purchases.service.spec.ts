import { expect, it } from "vitest";
import { RingPurchasesService } from "./ring-purchases.service";
function dbWith(answers: unknown[]) {
  const calls: string[] = [];
  const chain = (): unknown =>
    new Proxy(() => undefined, {
      get: (_, p) =>
        p === "then"
          ? (resolve: (v: unknown) => void) => resolve(answers.shift())
          : p === "transaction"
            ? (fn: (db: unknown) => unknown) => fn(db)
            : (..._args: unknown[]) => {
                calls.push(String(p));
                return chain();
              },
    });
  const db = chain();
  return { service: new RingPurchasesService(db as never), calls };
}
const input = {
  senderId: "buyer",
  quantity: 2,
  method: "coins" as const,
  requestKey: "00000000-0000-4000-8000-000000000001",
  expectedAmountKobo: 700000,
  expectedCoins: 50,
};
const at = new Date("2026-11-02T12:00:00Z");
const saved = {
  id: "payment",
  userId: "buyer",
  purpose: "rings",
  method: "coins",
  ringQuantity: 2,
  status: "verified",
  coinQuantity: 50,
  expiresAt: at,
  createdAt: at,
  reviewedAt: at,
  reference: "KR1",
  amountKobo: 700000,
  usdCents: 500,
};
it("replays an already confirmed purchase before checking changed rates or moving coins", async () => {
  const { service, calls } = dbWith([[], [saved]]);
  expect(await service.checkout("buyer", input)).toMatchObject({
    id: "payment",
    status: "verified",
    ringQuantity: 2,
  });
  expect(calls).not.toContain("update");
  expect(calls).not.toContain("insert");
});
it("refuses to reuse a request key for another quantity or method", async () => {
  const { service } = dbWith([[], [saved]]);
  await expect(service.checkout("buyer", { ...input, quantity: 4 })).rejects.toThrow(
    "another purchase",
  );
});
it("rejects switched accounts before any database operation", async () => {
  const { service, calls } = dbWith([]);
  await expect(service.checkout("ada", input)).rejects.toThrow("someone else");
  expect(calls).toEqual([]);
});
it("refuses a stale reviewed price before charging", async () => {
  const { service, calls } = dbWith([
    [],
    [],
    [{ enabled: 1, exchangeRateKobo: 140000, usdRates: { coin: { buy: 20 } } }],
    [],
  ]);
  await expect(service.checkout("buyer", input)).rejects.toThrow("price has changed");
  expect(calls).not.toContain("update");
  expect(calls).not.toContain("insert");
});
