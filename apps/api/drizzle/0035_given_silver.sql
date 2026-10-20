ALTER TABLE "member_subscription" ADD COLUMN "granted_by" text;--> statement-breakpoint
ALTER TABLE "member_subscription" ADD COLUMN "paid_until" timestamp with time zone;