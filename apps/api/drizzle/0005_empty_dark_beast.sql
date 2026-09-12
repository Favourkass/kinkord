ALTER TABLE "profile" ADD COLUMN "nationality" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "occupation" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "limits" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "social_links" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "profile_visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "display_name_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "username_changed_at" timestamp;