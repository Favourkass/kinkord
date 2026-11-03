ALTER TABLE "subscription_payment" ADD COLUMN "rings" integer;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD COLUMN "revoked_by" text;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD COLUMN "revoke_reason" text;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD COLUMN "usage_cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD COLUMN "usage_cancelled_by" text;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD COLUMN "usage_cancel_reason" text;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD CONSTRAINT "kink_ring_revoked_by_user_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD CONSTRAINT "kink_ring_usage_cancelled_by_user_id_fk" FOREIGN KEY ("usage_cancelled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;