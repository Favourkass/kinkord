CREATE TABLE "friendship" (
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"requester_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "friendship_user_a_user_b_pk" PRIMARY KEY("user_a","user_b"),
	CONSTRAINT "friendship_ordered_pair" CHECK ("friendship"."user_a" collate "C" < "friendship"."user_b" collate "C"),
	CONSTRAINT "friendship_requester_in_pair" CHECK ("friendship"."requester_id" in ("friendship"."user_a", "friendship"."user_b")),
	CONSTRAINT "friendship_valid_status" CHECK ("friendship"."status" in ('pending', 'accepted'))
);
--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_a_user_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_user_b_user_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendship" ADD CONSTRAINT "friendship_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendship_id_idx" ON "friendship" USING btree ("id");--> statement-breakpoint
CREATE INDEX "friendship_user_b_status_idx" ON "friendship" USING btree ("user_b","status");--> statement-breakpoint
-- Preserve the friendships the old application already recognizes. This does
-- not insert, delete, or update any follow, and emits no notifications.
-- Lock follows only while taking this one-time snapshot in the migration transaction.
LOCK TABLE "follow" IN SHARE MODE;
--> statement-breakpoint
INSERT INTO "friendship" ("user_a", "user_b", "requester_id", "status", "created_at", "accepted_at")
SELECT f."follower_id", f."following_id", f."follower_id", 'accepted',
       greatest(f."created_at", b."created_at"), greatest(f."created_at", b."created_at")
FROM "follow" f
JOIN "follow" b ON b."follower_id" = f."following_id" AND b."following_id" = f."follower_id"
WHERE f."follower_id" COLLATE "C" < f."following_id" COLLATE "C"
ON CONFLICT ("user_a", "user_b") DO NOTHING;
