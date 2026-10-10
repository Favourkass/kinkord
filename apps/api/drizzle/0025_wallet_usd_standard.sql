ALTER TABLE "wallet_settings" ADD COLUMN "usd_rates" jsonb DEFAULT '{"coin":{"buy":10,"redeem":8},"star":{"buy":100,"redeem":80},"crown":{"buy":1000,"redeem":800}}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_settings" ADD COLUMN "exchange_rate_kobo" integer DEFAULT 140000 NOT NULL;
--> statement-breakpoint
-- Keep the NGN cache aligned with the independent USD standard at ₦1,400/USD.
UPDATE "wallet_settings" SET "rates" = '{"coin":{"buy":14000,"redeem":11200},"star":{"buy":140000,"redeem":112000},"crown":{"buy":1400000,"redeem":1120000}}'::jsonb, "updated_at" = now() WHERE "id" = 1;
