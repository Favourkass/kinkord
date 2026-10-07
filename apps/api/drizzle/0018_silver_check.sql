ALTER TABLE "member_subscription" ADD COLUMN "started_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "member_subscription" ADD COLUMN "check_held_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "member_subscription" ADD COLUMN "check_hold_reason" text;--> statement-breakpoint
-- Members already on Silver: their run began with their first verified payment, not today.
UPDATE "member_subscription" SET "started_at" = "first"."reviewed_at"
FROM (
  SELECT "user_id", min("reviewed_at") AS "reviewed_at" FROM "subscription_payment"
  WHERE "status" = 'verified' AND "reviewed_at" IS NOT NULL GROUP BY "user_id"
) AS "first"
WHERE "first"."user_id" = "member_subscription"."user_id";
