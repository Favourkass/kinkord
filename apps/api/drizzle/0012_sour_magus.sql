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
ALTER TABLE "kyc_review" ADD CONSTRAINT "kyc_review_case_user_id_kyc_case_user_id_fk" FOREIGN KEY ("case_user_id") REFERENCES "public"."kyc_case"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_review" ADD CONSTRAINT "kyc_review_attempt_id_kyc_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."kyc_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_review" ADD CONSTRAINT "kyc_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kyc_review_attempt_stage_unique" ON "kyc_review" USING btree ("attempt_id","stage");--> statement-breakpoint
CREATE INDEX "kyc_review_open_idx" ON "kyc_review" USING btree ("status","created_at");