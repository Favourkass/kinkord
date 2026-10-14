ALTER TABLE "profile" ADD COLUMN "photo_skip_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- Skipping the photos arrives with this release, at first sign-up only. Everyone who
-- signed up before it keeps the rule they had: a missing photo is asked for again.
UPDATE "profile" SET "photo_skip_available" = false;
