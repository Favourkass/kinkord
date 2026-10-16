CREATE TABLE "wallet_balance" (
	"user_id" text NOT NULL,
	"currency" text NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wallet_balance_nonnegative" CHECK ("wallet_balance"."available" >= 0 and "wallet_balance"."reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_bank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"is_default" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"operation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"currency" text NOT NULL,
	"phase" text NOT NULL,
	"available_delta" integer NOT NULL,
	"reserved_delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_operation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"currency" text NOT NULL,
	"quantity" integer NOT NULL,
	"amount_kobo" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference" text NOT NULL,
	"request_key" uuid NOT NULL,
	"bank_name" text NOT NULL,
	"account_name" text NOT NULL,
	"account_number" text NOT NULL,
	"receipt_key" text,
	"sender_reference" text,
	"sender_account_name" text,
	"review_note" text,
	"reviewed_by" text,
	"settlement_reference" text,
	"paid_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_operation_positive" CHECK ("wallet_operation"."quantity" > 0 and "wallet_operation"."amount_kobo" > 0)
);
--> statement-breakpoint
CREATE TABLE "wallet_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"rates" jsonb NOT NULL,
	"minimum_kobo" integer NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallet_ledger" ADD CONSTRAINT "wallet_ledger_operation_id_wallet_operation_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."wallet_operation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_balance_member_currency_idx" ON "wallet_balance" USING btree ("user_id","currency");--> statement-breakpoint
CREATE INDEX "wallet_bank_user_idx" ON "wallet_bank" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_bank_default_idx" ON "wallet_bank" USING btree ("user_id") WHERE "wallet_bank"."is_default" = 1;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_ledger_operation_phase_idx" ON "wallet_ledger" USING btree ("operation_id","phase");--> statement-breakpoint
CREATE INDEX "wallet_ledger_member_idx" ON "wallet_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_operation_request_idx" ON "wallet_operation" USING btree ("user_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_operation_reference_idx" ON "wallet_operation" USING btree ("reference");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_settlement_reference_idx" ON "wallet_operation" USING btree ("kind","settlement_reference") WHERE "wallet_operation"."settlement_reference" is not null;--> statement-breakpoint
CREATE INDEX "wallet_operation_queue_idx" ON "wallet_operation" USING btree ("kind","status","created_at");--> statement-breakpoint
CREATE INDEX "wallet_operation_member_idx" ON "wallet_operation" USING btree ("user_id","created_at");