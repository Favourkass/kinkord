ALTER TABLE "profile" ADD COLUMN "genders" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "profile" SET "genders" = jsonb_build_array(CASE lower(trim("gender")) WHEN 'male' THEN 'Male' WHEN 'female' THEN 'Female' ELSE "gender" END) WHERE "gender" IS NOT NULL AND trim("gender") <> '';
