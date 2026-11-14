CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"goal_id" uuid,
	"days" smallint DEFAULT 127 NOT NULL,
	CONSTRAINT "routines_title_len" CHECK (char_length("routines"."title") between 1 and 500),
	CONSTRAINT "routines_priority_range" CHECK ("routines"."priority" between 0 and 4),
	CONSTRAINT "routines_days_range" CHECK ("routines"."days" between 1 and 127)
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "routine_id" uuid;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "routines_user_synced_idx" ON "routines" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "routines_goal_id_idx" ON "routines" USING btree ("goal_id");--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_routine_id_idx" ON "items" USING btree ("routine_id");