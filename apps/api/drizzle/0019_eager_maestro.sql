CREATE TABLE "bronze_verification_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"number" integer NOT NULL,
	"provider" text DEFAULT 'didit' NOT NULL,
	"provider_job_id" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"avatar_key" text NOT NULL,
	"profile_dob" text NOT NULL,
	"profile_gender" text NOT NULL,
	"profile_country" text NOT NULL,
	"profile_nationality" text,
	"checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"identity_binding" text,
	"reconciled_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (3) with time zone,
	CONSTRAINT "bronze_verification_attempt_provider_job_id_unique" UNIQUE("provider_job_id")
);
--> statement-breakpoint
CREATE TABLE "bronze_verification_callback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"result_code" text,
	"received_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bronze_verification_callback_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "bronze_verification_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "bronze_profile_match" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb,
	"started_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "bronze_verification_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"attempt_id" uuid NOT NULL,
	"reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewer_id" text,
	"evidence_reference" text,
	"decision_reason" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp (3) with time zone,
	CONSTRAINT "bronze_verification_review_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "bronze_verification" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"attempts_used" integer DEFAULT 0 NOT NULL,
	"current_attempt_id" uuid,
	"verified_at" timestamp (3) with time zone,
	"verified_avatar_key" text,
	"verified_dob" text,
	"verified_gender" text,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "show_verified_badge" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "bronze_verification_attempt" ADD CONSTRAINT "bronze_verification_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_callback" ADD CONSTRAINT "bronze_verification_callback_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_consent" ADD CONSTRAINT "bronze_verification_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_profile_match" ADD CONSTRAINT "bronze_profile_match_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_review" ADD CONSTRAINT "bronze_verification_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_review" ADD CONSTRAINT "bronze_verification_review_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_review" ADD CONSTRAINT "bronze_verification_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification" ADD CONSTRAINT "bronze_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification" ADD CONSTRAINT "bronze_verification_current_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("current_attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bronze_attempt_user_number_unique" ON "bronze_verification_attempt" USING btree ("user_id","number");--> statement-breakpoint
CREATE INDEX "bronze_attempt_open_idx" ON "bronze_verification_attempt" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "bronze_attempt_binding_idx" ON "bronze_verification_attempt" USING btree ("identity_binding") WHERE "bronze_verification_attempt"."identity_binding" is not null;--> statement-breakpoint
CREATE INDEX "bronze_callback_attempt_idx" ON "bronze_verification_callback" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bronze_consent_active_unique" ON "bronze_verification_consent" USING btree ("user_id","policy_version") WHERE "bronze_verification_consent"."withdrawn_at" is null;--> statement-breakpoint
CREATE INDEX "bronze_review_open_idx" ON "bronze_verification_review" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "bronze_review_user_idx" ON "bronze_verification_review" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bronze_review_reviewer_idx" ON "bronze_verification_review" USING btree ("reviewer_id");