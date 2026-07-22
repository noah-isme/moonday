CREATE TABLE "weekly_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" text NOT NULL,
	"summary" text NOT NULL,
	"what_helped" text NOT NULL,
	"what_felt_heavy" text NOT NULL,
	"suggested_focus" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"correction" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reflections_user_week_idx" UNIQUE("user_id","week_start")
);
--> statement-breakpoint
ALTER TABLE "weekly_reflections" ADD CONSTRAINT "weekly_reflections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
