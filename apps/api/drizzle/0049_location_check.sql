CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"purpose" text NOT NULL,
	"selected_country" text NOT NULL,
	"gps_status" text NOT NULL,
	"gps_country" text,
	"gps_accuracy_m" integer,
	"ip_country" text,
	"ip_asn" integer,
	"ip_network" text,
	"ip_anonymizer" text,
	"timezone" text,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"decision" text NOT NULL,
	"enforced" boolean NOT NULL,
	"network_key" text,
	"device_id" text,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "location_status" (
	"user_id" text PRIMARY KEY NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	"checked_country" text NOT NULL,
	"status" text NOT NULL,
	"approved_at" timestamp with time zone,
	"ip_country" text,
	"cell" text,
	"cell_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_check" ADD CONSTRAINT "location_check_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_status" ADD CONSTRAINT "location_status_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "location_check_user_idx" ON "location_check" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "location_check_device_idx" ON "location_check" USING btree ("device_id","created_at");--> statement-breakpoint
CREATE INDEX "location_check_network_idx" ON "location_check" USING btree ("network_key","created_at");--> statement-breakpoint
CREATE INDEX "location_check_created_idx" ON "location_check" USING btree ("created_at");