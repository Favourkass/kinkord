/** Isolated PostgreSQL/WASM verification. Build apps/api first. No external database or payment is used.
 * PGLITE_MODULE=/path/to/@electric-sql/pglite node scripts/tests/ring-purchases-integration.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../..");
const req = createRequire(path.join(root, "apps/api/package.json"));
const { PGlite } = require(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const { drizzle } = req("drizzle-orm/pglite");
const { randomUUID } = require("node:crypto");
const schema = require(path.join(root, "apps/api/dist/db/schema"));
const { RingPurchasesService } = require(
  path.join(root, "apps/api/dist/subscriptions/ring-purchases.service"),
);
const { PaymentsService } = require(
  path.join(root, "apps/api/dist/subscriptions/payments.service"),
);
const { SubscriptionsService } = require(
  path.join(root, "apps/api/dist/subscriptions/subscriptions.service"),
);
const { KinkRingsService } = require(
  path.join(root, "apps/api/dist/subscriptions/kink-rings.service"),
);
const { WalletService } = require(path.join(root, "apps/api/dist/wallet/wallet.service"));
(async () => {
  const pg = new PGlite();
  try {
    const journal = JSON.parse(
      fs.readFileSync(path.join(root, "apps/api/drizzle/meta/_journal.json")),
    );
    for (const entry of journal.entries)
      await pg.exec(fs.readFileSync(path.join(root, `apps/api/drizzle/${entry.tag}.sql`), "utf8"));
    const db = drizzle(pg, { schema });
    const events = [];
    const push = new Proxy(
      {},
      {
        get:
          (_, k) =>
          (...args) =>
            events.push({ type: k, args }),
      },
    );
    const storage = {
      describe: async () => ({ size: 123, contentType: "image/png" }),
      presignUpload: async () => "https://test.invalid/upload",
      presignDownload: async () => "https://test.invalid/receipt",
    };
    const purchase = new RingPurchasesService(db);
    const payments = new PaymentsService(db, storage, push);
    const subscriptions = new SubscriptionsService(db, storage, push);
    const rings = new KinkRingsService(db, push);
    const wallet = new WalletService(db, storage);
    await pg.exec(`insert into "user" (id,name,email,username,age_attested) values ('buyer','Buyer','buyer@example.invalid','buyer',true),('ada','Ada','ada@example.invalid','ada',true),('ben','Ben','ben@example.invalid','ben',true);
    insert into profile(user_id,display_name,country) values ('buyer','Buyer','NG'),('ada','Ada','NG'),('ben','Ben','NG');
    insert into payment_settings(id,bank_name,account_name,account_number,monthly_kobo,yearly_kobo,monthly_usd_cents,yearly_usd_cents) values (1,'Test Bank','Test account','0123456789',560000,3360000,400,2400);
    update wallet_settings set enabled=1,exchange_rate_kobo=140000,usd_rates='{"coin":{"buy":10,"redeem":8},"star":{"buy":100,"redeem":80},"crown":{"buy":1000,"redeem":800}}' where id=1;
    insert into wallet_balance(user_id,currency,available,earned) values ('buyer','coin',125,100);`);
    const scalar = async (sql) => (await pg.query(sql)).rows[0];
    const input = async (method = "coins", quantity = 2) => {
      const q = await purchase.quote("buyer", quantity);
      return {
        senderId: "buyer",
        method,
        quantity,
        requestKey: randomUUID(),
        expectedAmountKobo: q.amountKobo,
        expectedCoins: q.coins,
      };
    };
    const firstInput = await input();
    assert.equal(firstInput.expectedCoins, 50);
    const first = await purchase.checkout("buyer", firstInput);
    assert.equal(first.status, "verified");
    assert.equal(first.ringQuantity, 2);
    assert.deepEqual(
      await scalar("select available,earned from wallet_balance where user_id='buyer'"),
      { available: 75, earned: 75 },
    );
    assert.equal((await scalar("select count(*)::int n from kink_ring")).n, 2);
    assert.equal((await scalar("select count(*)::int n from member_subscription")).n, 0);
    const repeated = await purchase.checkout("buyer", firstInput);
    assert.equal(repeated.id, first.id);
    assert.equal(
      (await scalar("select available from wallet_balance where user_id='buyer'")).available,
      75,
    );
    await assert.rejects(
      purchase.checkout("buyer", { ...firstInput, quantity: 4 }),
      /another purchase/,
    );
    await assert.rejects(purchase.checkout("ada", firstInput), /someone else/);
    await assert.rejects(purchase.checkout("buyer", await input("coins", 4)), /Insufficient/);
    const stale = await input();
    await pg.exec(
      "update wallet_settings set usd_rates=jsonb_set(usd_rates,'{coin,buy}','20') where id=1",
    );
    await assert.rejects(purchase.checkout("buyer", stale), /price has changed/);
    await pg.exec(
      "update wallet_settings set usd_rates=jsonb_set(usd_rates,'{coin,buy}','10') where id=1",
    );
    // Fault injection proves a failed issuance rolls back the debit AND payment record.
    await pg.exec(`create function reject_test_ring() returns trigger language plpgsql as $$ begin raise exception 'test issuance failure'; end $$;
    create trigger fail_ring before insert on kink_ring for each row execute function reject_test_ring();`);
    await assert.rejects(purchase.checkout("buyer", await input()), /insert into/);
    assert.equal(
      (await scalar("select available from wallet_balance where user_id='buyer'")).available,
      75,
    );
    assert.equal((await scalar("select count(*)::int n from subscription_payment")).n, 1);
    await pg.exec("drop trigger fail_ring on kink_ring; drop function reject_test_ring();");
    // Bank proof never issues rings before review. Keep Silver and ring checkouts separate.
    const bankInput = await input("bank");
    const bank = await purchase.checkout("buyer", bankInput);
    const otherBank = await purchase.checkout("buyer", await input("bank"));
    assert.notEqual(bank.amountKobo, otherBank.amountKobo);
    assert.equal((await purchase.checkout("buyer", bankInput)).id, bank.id);
    const silver = await subscriptions.checkout("buyer", "monthly");
    assert.notEqual(silver.id, bank.id);
    assert.equal((await subscriptions.payment("buyer", bank.id)).status, "pending");
    await assert.rejects(subscriptions.payment("ada", bank.id), /not found/);
    const proof = {
      reference: bank.reference,
      amountKobo: bank.amountKobo,
      senderBankName: "Test Bank",
      senderAccountName: "Buyer",
      senderAccountNumber: "0123456789",
      receiptKey: `payments/buyer/${bank.id}/test.png`,
    };
    await assert.rejects(
      subscriptions.submit("buyer", bank.id, {
        ...proof,
        receiptKey: `payments/ada/${bank.id}/test.png`,
      }),
      /unknown upload/,
    );
    await subscriptions.submit("buyer", bank.id, proof);
    assert.equal((await scalar("select count(*)::int n from kink_ring")).n, 2);
    const verified = await payments.verify("admin", bank.id);
    assert.equal(verified.silverUntil, null);
    assert.equal((await scalar("select count(*)::int n from member_subscription")).n, 0);
    assert.equal((await scalar("select count(*)::int n from kink_ring")).n, 4);
    assert.equal(
      (
        await scalar(
          "select count(*)::int n from kink_ring where expires_at-created_at > interval '89 days' and expires_at-created_at <= interval '91 days'",
        )
      ).n,
      4,
    );
    await assert.rejects(payments.verify("admin", bank.id), /already/);
    assert.equal(events.filter((e) => e.type === "ringPurchaseVerified").length, 1);
    await payments.reject("admin", otherBank.id, "Transfer not received");
    assert.equal((await scalar("select count(*)::int n from kink_ring")).n, 4);
    assert.equal(events.filter((e) => e.type === "ringPurchaseRejected").length, 1);
    const history = await purchase.history("buyer");
    assert.equal(history.items.length, 3);
    assert.equal((await purchase.history("ada")).items.length, 0);
    assert.equal(
      (await wallet.history("buyer")).filter((r) => r.kind === "ring_purchase").length,
      1,
    );
    // Explicit allocations + personal message atomically grant recipients their Silver months.
    const available = await rings.mine("buyer");
    const gifts = [
      { ringId: available.available[0].id, username: "ada", message: "Enjoy your ring!" },
      { ringId: available.available[1].id, username: "ben" },
    ];
    const gifted = await rings.giveSelected("buyer", gifts);
    assert.equal(gifted.gifts.length, 2);
    const before = await pg.query(
      "select user_id,current_period_end from member_subscription order by user_id",
    );
    await rings.giveSelected("buyer", gifts);
    assert.deepEqual(
      (
        await pg.query(
          "select user_id,current_period_end from member_subscription order by user_id",
        )
      ).rows,
      before.rows,
    );
    assert.equal(events.filter((e) => e.type === "kinkRingGiven").length, 2);
    assert.equal(
      (await scalar("select gift_message from kink_ring where given_to='ada'")).gift_message,
      "Enjoy your ring!",
    );
    const remainder = available.available[2].id;
    await pg.query("update kink_ring set expires_at=now()-interval '1 day' where id=$1", [
      remainder,
    ]);
    await assert.rejects(
      rings.giveSelected("buyer", [{ ringId: remainder, username: "ada" }]),
      /expired/,
    );
    // An abandoned ring checkout releases its exact bank amount after the proof grace period.
    const abandoned = await purchase.checkout("buyer", await input("bank"));
    await pg.query(
      "update subscription_payment set expires_at=now()-interval '10 days' where id=$1",
      [abandoned.id],
    );
    const renewed = await purchase.checkout("buyer", await input("bank"));
    assert.equal(renewed.amountKobo, abandoned.amountKobo);
    assert.equal((await subscriptions.payment("buyer", abandoned.id)).status, "expired");
    console.log(
      "PASS: all migrations, pricing, coins, replay, rollback, ownership, bank proof, approval/rejection, history, gifting, expiry; no real transactions.",
    );
  } finally {
    await pg.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
