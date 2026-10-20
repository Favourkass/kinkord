CREATE TABLE "community_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"rules" text,
	"category" text NOT NULL,
	"privacy" text DEFAULT 'open' NOT NULL,
	"country" text,
	"state" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "community_group_privacy" CHECK ("community_group"."privacy" in ('open', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "group_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"actor_id" text,
	"subject_user_id" text,
	"subject_post_id" uuid,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_member" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"joined_at" timestamp with time zone,
	CONSTRAINT "group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id"),
	CONSTRAINT "group_member_role" CHECK ("group_member"."role" in ('owner', 'moderator', 'member')),
	CONSTRAINT "group_member_status" CHECK ("group_member"."status" in ('active', 'pending'))
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "show_groups" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "community_group" ADD CONSTRAINT "community_group_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_log" ADD CONSTRAINT "group_log_group_id_community_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_log" ADD CONSTRAINT "group_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_log" ADD CONSTRAINT "group_log_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_group_id_community_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_member" ADD CONSTRAINT "group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "community_group_slug_idx" ON "community_group" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "community_group_place_idx" ON "community_group" USING btree ("country","state");--> statement-breakpoint
CREATE INDEX "group_log_group_idx" ON "group_log" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE INDEX "group_member_user_idx" ON "group_member" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "group_member_group_idx" ON "group_member" USING btree ("group_id","status","role");--> statement-breakpoint
CREATE UNIQUE INDEX "group_member_one_owner_idx" ON "group_member" USING btree ("group_id") WHERE "group_member"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_group_id_community_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."community_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_group_activity_idx" ON "post" USING btree ("group_id","last_activity_at") WHERE "post"."group_id" is not null;