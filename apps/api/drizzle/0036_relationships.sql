CREATE TABLE "member_relationship" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a" text NOT NULL,
	"user_b" text NOT NULL,
	"requester_id" text NOT NULL,
	"kind" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "member_relationship_ordered_pair" CHECK ("member_relationship"."user_a" collate "C" < "member_relationship"."user_b" collate "C"),
	CONSTRAINT "member_relationship_requester_in_pair" CHECK ("member_relationship"."requester_id" in ("member_relationship"."user_a", "member_relationship"."user_b")),
	CONSTRAINT "member_relationship_valid_status" CHECK ("member_relationship"."status" in ('pending', 'accepted')),
	CONSTRAINT "member_relationship_valid_kind" CHECK ("member_relationship"."kind" in ('ds', 'romantic'))
);
--> statement-breakpoint
ALTER TABLE "member_relationship" ADD CONSTRAINT "member_relationship_user_a_user_id_fk" FOREIGN KEY ("user_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_relationship" ADD CONSTRAINT "member_relationship_user_b_user_id_fk" FOREIGN KEY ("user_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_relationship" ADD CONSTRAINT "member_relationship_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_relationship_pair_kind_idx" ON "member_relationship" USING btree ("user_a","user_b","kind");--> statement-breakpoint
CREATE INDEX "member_relationship_user_b_idx" ON "member_relationship" USING btree ("user_b","status");