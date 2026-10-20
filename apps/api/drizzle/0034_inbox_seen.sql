CREATE TABLE "chat_inbox_seen" (
	"user_id" text PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_inbox_seen" ADD CONSTRAINT "chat_inbox_seen_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;