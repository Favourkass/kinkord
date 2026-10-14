CREATE TABLE "verification_admin_step_up" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"verified_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_admin_step_up_failure" (
	"user_id" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp (3) with time zone
);
--> statement-breakpoint
ALTER TABLE "bronze_verification_attempt" ADD COLUMN "provider_status" text;--> statement-breakpoint
ALTER TABLE "bronze_verification_attempt" ADD COLUMN "result_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_admin_step_up" ADD CONSTRAINT "verification_admin_step_up_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_admin_step_up" ADD CONSTRAINT "verification_admin_step_up_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_admin_step_up_failure" ADD CONSTRAINT "verification_admin_step_up_failure_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "verification_admin_step_up_user_idx" ON "verification_admin_step_up" USING btree ("user_id","expires_at");