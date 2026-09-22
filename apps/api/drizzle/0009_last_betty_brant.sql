CREATE TABLE "bronze_profile_match" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bronze_profile_match" ADD CONSTRAINT "bronze_profile_match_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE cascade ON UPDATE no action;