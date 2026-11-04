ALTER TABLE "subscription_payment" ADD COLUMN "purpose" text DEFAULT 'silver' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD COLUMN "ring_quantity" integer;--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD COLUMN "method" text DEFAULT 'bank' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD COLUMN "request_key" uuid;--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD COLUMN "coin_quantity" integer;--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD COLUMN "earned_coins_spent" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payment_request_idx" ON "subscription_payment" USING btree ("user_id","request_key");--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD CONSTRAINT "ring_purchase_quantity" CHECK ("subscription_payment"."purpose" != 'rings' or ("subscription_payment"."ring_quantity" is not null and "subscription_payment"."ring_quantity" between 2 and 100 and "subscription_payment"."ring_quantity" % 2 = 0));--> statement-breakpoint
ALTER TABLE "subscription_payment" ADD CONSTRAINT "ring_purchase_coins" CHECK ("subscription_payment"."method" != 'coins' or ("subscription_payment"."purpose" = 'rings' and "subscription_payment"."status" = 'verified' and "subscription_payment"."coin_quantity" is not null and "subscription_payment"."earned_coins_spent" is not null and "subscription_payment"."coin_quantity" > 0 and "subscription_payment"."earned_coins_spent" >= 0 and "subscription_payment"."earned_coins_spent" <= "subscription_payment"."coin_quantity"));