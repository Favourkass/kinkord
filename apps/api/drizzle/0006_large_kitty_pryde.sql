CREATE TABLE "profile_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_media" ADD CONSTRAINT "profile_media_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_media_user_idx" ON "profile_media" USING btree ("user_id","created_at");--> statement-breakpoint
INSERT INTO "profile_media" ("user_id", "kind", "key", "created_at")
SELECT "user_id", 'avatar', "avatar_key", "updated_at" FROM "profile" WHERE "avatar_key" IS NOT NULL;--> statement-breakpoint
INSERT INTO "profile_media" ("user_id", "kind", "key", "created_at")
SELECT "user_id", 'cover', "cover_key", "updated_at" FROM "profile" WHERE "cover_key" IS NOT NULL;
