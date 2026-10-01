CREATE TABLE "member_block" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_block_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text NOT NULL,
	"reported_user_id" text NOT NULL,
	"conversation_id" uuid,
	"reason" text NOT NULL,
	"details" text,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member_block" ADD CONSTRAINT "member_block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_block" ADD CONSTRAINT "member_block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_block_blocked_idx" ON "member_block" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "report_status_created_idx" ON "report" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "report_reporter_created_idx" ON "report" USING btree ("reporter_id","created_at");--> statement-breakpoint
CREATE INDEX "report_reported_user_idx" ON "report" USING btree ("reported_user_id");