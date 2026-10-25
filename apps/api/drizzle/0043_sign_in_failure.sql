CREATE TABLE "sign_in_failure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sign_in_failure_key_idx" ON "sign_in_failure" USING btree ("key","created_at");