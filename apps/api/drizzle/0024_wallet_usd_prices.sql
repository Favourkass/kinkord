ALTER TABLE "wallet_settings" ADD COLUMN "usd_rates" jsonb DEFAULT '{"coin":{"buy":10,"redeem":8},"star":{"buy":100,"redeem":80},"crown":{"buy":1000,"redeem":800}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_settings" ADD COLUMN "exchange_rate_kobo" integer DEFAULT 140000 NOT NULL;--> statement-breakpoint
-- Every wallet takes the USD prices the founders asked for: $0.10, $1 and $10 a unit,
-- redeemed at $0.08, $0.80 and $8, at ₦1,400 to the dollar. Prices are read from the
-- columns above from now on; the naira column is kept in step, so it agrees with them.
-- The minimum withdrawal and the on/off switch are left as the founders set them.
UPDATE "wallet_settings" SET "rates" = '{"coin":{"buy":14000,"redeem":11200},"star":{"buy":140000,"redeem":112000},"crown":{"buy":1400000,"redeem":1120000}}'::jsonb, "updated_at" = now() WHERE "id" = 1;
--> statement-breakpoint
-- A wallet that was never set up starts with those prices and a ₦100,000 minimum
-- withdrawal, switched off.
INSERT INTO "wallet_settings" ("id", "rates", "minimum_kobo", "enabled", "updated_by")
VALUES (1, '{"coin":{"buy":14000,"redeem":11200},"star":{"buy":140000,"redeem":112000},"crown":{"buy":1400000,"redeem":1120000}}'::jsonb, 10000000, 0, 'system:wallet-usd-prices')
ON CONFLICT ("id") DO NOTHING;
