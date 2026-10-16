CREATE TABLE "suggestion_dismissal" (
	"user_id" text NOT NULL,
	"dismissed_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suggestion_dismissal_user_id_dismissed_user_id_pk" PRIMARY KEY("user_id","dismissed_user_id")
);
--> statement-breakpoint
ALTER TABLE "suggestion_dismissal" ADD CONSTRAINT "suggestion_dismissal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestion_dismissal" ADD CONSTRAINT "suggestion_dismissal_dismissed_user_id_user_id_fk" FOREIGN KEY ("dismissed_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;