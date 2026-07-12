CREATE TABLE "records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"source_text" text,
	"metric" text,
	"value_numeric" numeric,
	"unit" text,
	"duration_minutes" integer,
	"value_text" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "records_category_check" CHECK ("records"."category" in ('work', 'health', 'meal', 'learning', 'creation', 'household', 'memo', 'other')),
	CONSTRAINT "records_duration_minutes_non_negative_check" CHECK ("records"."duration_minutes" is null or "records"."duration_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_provider" text NOT NULL,
	"auth_user_id" text NOT NULL,
	"display_name" text,
	"timezone" text DEFAULT 'Asia/Tokyo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_provider_auth_user_id_unique" UNIQUE("auth_provider","auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_unique" UNIQUE("workspace_id","user_id"),
	CONSTRAINT "workspace_members_role_check" CHECK ("workspace_members"."role" in ('owner', 'admin', 'member', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"personal_owner_user_id" uuid,
	"timezone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_type_check" CHECK ("workspaces"."type" in ('personal', 'shared')),
	CONSTRAINT "workspaces_personal_owner_scope_check" CHECK ((
        ("workspaces"."type" = 'personal' and "workspaces"."personal_owner_user_id" is not null)
        or ("workspaces"."type" <> 'personal' and "workspaces"."personal_owner_user_id" is null)
      ))
);
--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "records" ADD CONSTRAINT "records_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_personal_owner_user_id_users_id_fk" FOREIGN KEY ("personal_owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "records_workspace_id_occurred_at_idx" ON "records" USING btree ("workspace_id","occurred_at" DESC NULLS LAST) WHERE "records"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "records_workspace_id_created_by_user_id_occurred_at_idx" ON "records" USING btree ("workspace_id","created_by_user_id","occurred_at" DESC NULLS LAST) WHERE "records"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "records_workspace_id_category_occurred_at_idx" ON "records" USING btree ("workspace_id","category","occurred_at" DESC NULLS LAST) WHERE "records"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_role_idx" ON "workspace_members" USING btree ("workspace_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_personal_owner_unique" ON "workspaces" USING btree ("personal_owner_user_id") WHERE "workspaces"."type" = 'personal';--> statement-breakpoint
CREATE INDEX "workspaces_created_by_user_id_idx" ON "workspaces" USING btree ("created_by_user_id");