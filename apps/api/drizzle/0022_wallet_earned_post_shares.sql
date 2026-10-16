CREATE TABLE "post_share" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_share_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "wallet_balance" ADD COLUMN "earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_gift" ADD COLUMN "sender_earned" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD COLUMN "earned_delta" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "post_share" ADD CONSTRAINT "post_share_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_share" ADD CONSTRAINT "post_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_gift_post_idx" ON "wallet_gift" USING btree ("post_id");--> statement-breakpoint
ALTER TABLE "wallet_balance" ADD CONSTRAINT "wallet_balance_earned" CHECK ("wallet_balance"."earned" >= 0 and "wallet_balance"."earned" <= "wallet_balance"."available");