CREATE TABLE "member_subscription" (
	"user_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"monthly_kobo" integer NOT NULL,
	"yearly_kobo" integer NOT NULL,
	"monthly_usd_cents" integer NOT NULL,
	"yearly_usd_cents" integer NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"period" text NOT NULL,
	"reference" text NOT NULL,
	"amount_kobo" integer NOT NULL,
	"usd_cents" integer NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_reference" text,
	"paid_amount_kobo" integer,
	"sender_bank_name" text,
	"sender_account_name" text,
	"sender_account_number" text,
	"receipt_key" text,
	"submitted_at" timestamp with time zone,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_subscription" ADD CONSTRAINT "member_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payment_reference_idx" ON "subscription_payment" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_payment_open_amount_idx" ON "subscription_payment" USING btree ("amount_kobo") WHERE "subscription_payment"."status" in ('pending', 'submitted');--> statement-breakpoint
CREATE INDEX "subscription_payment_user_idx" ON "subscription_payment" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_payment_status_idx" ON "subscription_payment" USING btree ("status","submitted_at");