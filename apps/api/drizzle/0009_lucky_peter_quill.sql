CREATE TABLE "post_save" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_save_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "repost_of_id" uuid;--> statement-breakpoint
ALTER TABLE "post_save" ADD CONSTRAINT "post_save_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_save" ADD CONSTRAINT "post_save_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_save_user_idx" ON "post_save" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_repost_of_id_post_id_fk" FOREIGN KEY ("repost_of_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_repost_of_idx" ON "post" USING btree ("repost_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_repost_unique" ON "post" USING btree ("author_id","repost_of_id") WHERE "post"."deleted_at" is null and "post"."repost_of_id" is not null;