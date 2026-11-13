CREATE TABLE "board_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"board_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "board_columns_name_len" CHECK (char_length("board_columns"."name") between 1 and 80)
);
--> statement-breakpoint
CREATE TABLE "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"name" text NOT NULL,
	"icon" text,
	"layout" text DEFAULT 'list' NOT NULL,
	"sort_key" text NOT NULL,
	CONSTRAINT "boards_name_len" CHECK (char_length("boards"."name") between 1 and 120),
	CONSTRAINT "boards_layout_valid" CHECK ("boards"."layout" in ('list', 'kanban'))
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"title" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"plan_scope" text,
	"plan_date" date,
	"board_id" uuid,
	"column_id" uuid,
	"sort_key" text NOT NULL,
	"done_at" timestamp with time zone,
	CONSTRAINT "items_title_len" CHECK (char_length("items"."title") between 1 and 500),
	CONSTRAINT "items_notes_len" CHECK (char_length("items"."notes") <= 20000),
	CONSTRAINT "items_status_valid" CHECK ("items"."status" in ('todo', 'doing', 'done', 'dropped')),
	CONSTRAINT "items_priority_range" CHECK ("items"."priority" between 0 and 4),
	CONSTRAINT "items_scope_valid" CHECK ("items"."plan_scope" in ('day', 'week', 'month')),
	CONSTRAINT "items_plan_pair" CHECK (("items"."plan_scope" is null) = ("items"."plan_date" is null)),
	CONSTRAINT "items_plan_month_aligned" CHECK ("items"."plan_scope" is distinct from 'month' or extract(day from "items"."plan_date") = 1)
);
--> statement-breakpoint
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_column_id_board_columns_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."board_columns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "board_columns_user_synced_idx" ON "board_columns" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "board_columns_board_id_idx" ON "board_columns" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "boards_user_synced_idx" ON "boards" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "items_user_synced_idx" ON "items" USING btree ("user_id","synced_at");--> statement-breakpoint
CREATE INDEX "items_board_id_idx" ON "items" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "items_column_id_idx" ON "items" USING btree ("column_id");