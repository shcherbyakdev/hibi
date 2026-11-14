CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"icon" text,
	"weekly_target" smallint DEFAULT 5 NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "goals_name_len" CHECK (char_length("goals"."name") between 1 and 120),
	CONSTRAINT "goals_notes_len" CHECK (char_length("goals"."notes") <= 20000),
	CONSTRAINT "goals_weekly_target_range" CHECK ("goals"."weekly_target" between 1 and 7)
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "goal_id" uuid;--> statement-breakpoint
CREATE INDEX "goals_user_synced_idx" ON "goals" USING btree ("user_id","synced_at");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_goal_id_idx" ON "items" USING btree ("goal_id");