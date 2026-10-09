CREATE TABLE "bronze_verification_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"number" integer NOT NULL,
	"provider" text DEFAULT 'smile_id' NOT NULL,
	"provider_job_id" text NOT NULL,
	"status" text DEFAULT 'started' NOT NULL,
	"avatar_key" text NOT NULL,
	"profile_dob" text NOT NULL,
	"profile_gender" text NOT NULL,
	"profile_country" text NOT NULL,
	"checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"failure_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "bronze_verification_attempt_provider_job_id_unique" UNIQUE("provider_job_id")
);
--> statement-breakpoint
CREATE TABLE "bronze_verification_callback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"result_code" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bronze_verification_callback_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "bronze_verification_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bronze_profile_match" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
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
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	CONSTRAINT "bronze_verification_review_attempt_id_unique" UNIQUE("attempt_id")
);
--> statement-breakpoint
CREATE TABLE "bronze_verification" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"attempts_used" integer DEFAULT 0 NOT NULL,
	"current_attempt_id" uuid,
	"verified_at" timestamp,
	"verified_avatar_key" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_user_id" text NOT NULL,
	"stage" text NOT NULL,
	"provider" text NOT NULL,
	"provider_session_reference" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "kyc_attempt_provider_session_reference_unique" UNIQUE("provider_session_reference")
);
--> statement-breakpoint
CREATE TABLE "kyc_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_user_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"event_type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_case" (
	"user_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"policy_version" text,
	"verified_at" timestamp,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_consent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_user_id" text NOT NULL,
	"category" text NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "kyc_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_user_id" text NOT NULL,
	"attempt_id" uuid,
	"stage" text NOT NULL,
	"reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewer_id" text,
	"evidence_reference" text,
	"decision_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "kyc_stage_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_user_id" text NOT NULL,
	"attempt_id" uuid,
	"stage" text NOT NULL,
	"status" text NOT NULL,
	"provider" text,
	"provider_reference" text,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reason_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assessed_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "bronze_verification_attempt" ADD CONSTRAINT "bronze_verification_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_callback" ADD CONSTRAINT "bronze_verification_callback_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_consent" ADD CONSTRAINT "bronze_verification_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_profile_match" ADD CONSTRAINT "bronze_profile_match_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_review" ADD CONSTRAINT "bronze_verification_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_review" ADD CONSTRAINT "bronze_verification_review_attempt_id_bronze_verification_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."bronze_verification_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification_review" ADD CONSTRAINT "bronze_verification_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bronze_verification" ADD CONSTRAINT "bronze_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_attempt" ADD CONSTRAINT "kyc_attempt_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_event" ADD CONSTRAINT "kyc_audit_event_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_event" ADD CONSTRAINT "kyc_audit_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_case" ADD CONSTRAINT "kyc_case_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_consent" ADD CONSTRAINT "kyc_consent_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_review" ADD CONSTRAINT "kyc_review_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_review" ADD CONSTRAINT "kyc_review_attempt_id_kyc_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."kyc_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_review" ADD CONSTRAINT "kyc_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_stage_result" ADD CONSTRAINT "kyc_stage_result_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_stage_result" ADD CONSTRAINT "kyc_stage_result_attempt_id_kyc_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."kyc_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bronze_attempt_user_number_unique" ON "bronze_verification_attempt" USING btree ("user_id","number");--> statement-breakpoint
CREATE INDEX "bronze_attempt_user_idx" ON "bronze_verification_attempt" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bronze_consent_user_idx" ON "bronze_verification_consent" USING btree ("user_id","accepted_at");--> statement-breakpoint
CREATE INDEX "kyc_attempt_case_stage_idx" ON "kyc_attempt" USING btree ("case_user_id","stage");--> statement-breakpoint
CREATE INDEX "kyc_attempt_status_idx" ON "kyc_attempt" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_audit_case_created_idx" ON "kyc_audit_event" USING btree ("case_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_consent_case_category_version_unique" ON "kyc_consent" USING btree ("case_user_id","category","policy_version");--> statement-breakpoint
CREATE INDEX "kyc_consent_case_idx" ON "kyc_consent" USING btree ("case_user_id","accepted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_review_attempt_stage_unique" ON "kyc_review" USING btree ("attempt_id","stage");--> statement-breakpoint
CREATE INDEX "kyc_review_open_idx" ON "kyc_review" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "kyc_stage_result_case_stage_idx" ON "kyc_stage_result" USING btree ("case_user_id","stage","assessed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_stage_result_attempt_stage_unique" ON "kyc_stage_result" USING btree ("attempt_id","stage");