import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authProvider: text("auth_provider").notNull(),
    authUserId: text("auth_user_id").notNull(),
    displayName: text("display_name"),
    timezone: text("timezone").notNull().default("Asia/Tokyo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("users_auth_provider_auth_user_id_unique").on(table.authProvider, table.authUserId),
  ],
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    personalOwnerUserId: uuid("personal_owner_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("workspaces_type_check", sql`${table.type} in ('personal', 'shared')`),
    check(
      "workspaces_personal_owner_scope_check",
      sql`(
        (${table.type} = 'personal' and ${table.personalOwnerUserId} is not null)
        or (${table.type} <> 'personal' and ${table.personalOwnerUserId} is null)
      )`,
    ),
    uniqueIndex("workspaces_personal_owner_unique")
      .on(table.personalOwnerUserId)
      .where(sql`${table.type} = 'personal'`),
    index("workspaces_created_by_user_id_idx").on(table.createdByUserId),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("workspace_members_role_check", sql`${table.role} in ('owner', 'admin', 'member', 'viewer')`),
    unique("workspace_members_workspace_id_user_id_unique").on(table.workspaceId, table.userId),
    index("workspace_members_user_id_idx").on(table.userId),
    index("workspace_members_workspace_id_role_idx").on(table.workspaceId, table.role),
  ],
);

export const records = pgTable(
  "records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    category: text("category").notNull(),
    title: text("title").notNull(),
    sourceText: text("source_text"),
    metric: text("metric"),
    valueNumeric: numeric("value_numeric"),
    unit: text("unit"),
    durationMinutes: integer("duration_minutes"),
    valueText: text("value_text"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "records_category_check",
      sql`${table.category} in ('work', 'health', 'meal', 'learning', 'creation', 'household', 'memo', 'other')`,
    ),
    check(
      "records_duration_minutes_non_negative_check",
      sql`${table.durationMinutes} is null or ${table.durationMinutes} >= 0`,
    ),
    index("records_workspace_id_occurred_at_idx")
      .on(table.workspaceId, table.occurredAt.desc())
      .where(sql`${table.deletedAt} is null`),
    index("records_workspace_id_created_by_user_id_occurred_at_idx").on(
      table.workspaceId,
      table.createdByUserId,
      table.occurredAt.desc(),
    ).where(sql`${table.deletedAt} is null`),
    index("records_workspace_id_category_occurred_at_idx").on(
      table.workspaceId,
      table.category,
      table.occurredAt.desc(),
    ).where(sql`${table.deletedAt} is null`),
  ],
);
