ALTER TABLE "profile" ADD COLUMN "relationship_status" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "looking_for" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "interests" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "location" text;