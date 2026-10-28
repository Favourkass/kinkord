CREATE TABLE "profile_post_pin" (
	"user_id" text PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_post_pin" ADD CONSTRAINT "profile_post_pin_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_post_pin" ADD CONSTRAINT "profile_post_pin_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_post_pin_post_idx" ON "profile_post_pin" USING btree ("post_id");