CREATE TABLE "kink_ring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"payment_id" uuid,
	"seq" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"given_to" text,
	"given_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kink_ring" ADD CONSTRAINT "kink_ring_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD CONSTRAINT "kink_ring_payment_id_subscription_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."subscription_payment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kink_ring" ADD CONSTRAINT "kink_ring_given_to_user_id_fk" FOREIGN KEY ("given_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kink_ring_owner_idx" ON "kink_ring" USING btree ("owner_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "kink_ring_payment_seq_idx" ON "kink_ring" USING btree ("payment_id","seq");--> statement-breakpoint
-- The founders' rings to try giving (founder, 2026-10-27): three each, expiring
-- 30, 60 and 90 days from now. Any other database has neither account: nothing.
INSERT INTO "kink_ring" ("owner_id", "seq", "expires_at")
SELECT u."id", s.seq, now() + make_interval(days => 30 * s.seq)
FROM "user" u CROSS JOIN generate_series(1, 3) AS s(seq)
WHERE lower(u."email") IN ('nnabuekassidy@gmail.com', 'maxihandsome@gmail.com')
  AND u."email_verified" = true;
