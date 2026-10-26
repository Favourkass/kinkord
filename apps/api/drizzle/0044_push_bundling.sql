CREATE TABLE "push_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"off" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_sent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "push_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_preference" ADD CONSTRAINT "push_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_sent" ADD CONSTRAINT "push_sent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_sent_user_idx" ON "push_sent" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE INDEX "notification_push_pending_idx" ON "notification" USING btree ("created_at") WHERE push_pending;