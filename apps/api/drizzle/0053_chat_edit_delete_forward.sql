CREATE TABLE "message_edit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"body" text,
	"replaced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_hidden" (
	"user_id" text NOT NULL,
	"message_id" uuid NOT NULL,
	"hidden_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_hidden_user_id_message_id_pk" PRIMARY KEY("user_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "forwarded_from_id" uuid;--> statement-breakpoint
ALTER TABLE "message_edit" ADD CONSTRAINT "message_edit_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_edit" ADD CONSTRAINT "message_edit_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_hidden" ADD CONSTRAINT "message_hidden_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_hidden" ADD CONSTRAINT "message_hidden_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_edit_message_idx" ON "message_edit" USING btree ("message_id","replaced_at");--> statement-breakpoint
CREATE INDEX "message_edit_sender_idx" ON "message_edit" USING btree ("sender_id","replaced_at");