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
ALTER TABLE "kyc_attempt" ADD CONSTRAINT "kyc_attempt_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_event" ADD CONSTRAINT "kyc_audit_event_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_event" ADD CONSTRAINT "kyc_audit_event_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_case" ADD CONSTRAINT "kyc_case_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_consent" ADD CONSTRAINT "kyc_consent_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_stage_result" ADD CONSTRAINT "kyc_stage_result_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_stage_result" ADD CONSTRAINT "kyc_stage_result_attempt_id_kyc_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."kyc_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kyc_attempt_case_stage_idx" ON "kyc_attempt" USING btree ("case_user_id","stage");--> statement-breakpoint
CREATE INDEX "kyc_attempt_status_idx" ON "kyc_attempt" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kyc_audit_case_created_idx" ON "kyc_audit_event" USING btree ("case_user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_consent_case_category_version_unique" ON "kyc_consent" USING btree ("case_user_id","category","policy_version");--> statement-breakpoint
CREATE INDEX "kyc_consent_case_idx" ON "kyc_consent" USING btree ("case_user_id","accepted_at");--> statement-breakpoint
CREATE INDEX "kyc_stage_result_case_stage_idx" ON "kyc_stage_result" USING btree ("case_user_id","stage","assessed_at");