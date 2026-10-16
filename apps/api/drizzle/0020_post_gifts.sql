CREATE TABLE "wallet_gift" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"post_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"quantity" integer NOT NULL,
	"request_key" uuid NOT NULL,
	"sender_name" text NOT NULL,
	"recipient_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_gift_positive" CHECK ("wallet_gift"."quantity" > 0 and "wallet_gift"."quantity" <= 1000000),
	CONSTRAINT "wallet_gift_different_members" CHECK ("wallet_gift"."sender_id" <> "wallet_gift"."recipient_id"),
	CONSTRAINT "wallet_gift_currency" CHECK ("wallet_gift"."currency" in ('coin', 'star', 'crown'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_gift_request_idx" ON "wallet_gift" USING btree ("sender_id","request_key");--> statement-breakpoint
CREATE INDEX "wallet_gift_sender_idx" ON "wallet_gift" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "wallet_gift_recipient_idx" ON "wallet_gift" USING btree ("recipient_id","created_at");