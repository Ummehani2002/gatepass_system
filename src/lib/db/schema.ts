import { relations } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "admin", "member"]);
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  emailUnique: uniqueIndex("users_email_unique").on(table.email),
}));

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  slugUnique: uniqueIndex("organizations_slug_unique").on(table.slug),
}));

export const memberships = pgTable("memberships", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  userOrgUnique: uniqueIndex("memberships_user_org_unique").on(
    table.userId,
    table.organizationId,
  ),
  orgIdx: index("memberships_organization_id_idx").on(table.organizationId),
}));

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  orgIdx: index("projects_organization_id_idx").on(table.organizationId),
}));

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  // Denormalized from projects.organization_id so every tenant-scoped query
  // and index can filter directly without a join — see ARCHITECTURE.md.
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("todo"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  orgStatusIdx: index("tasks_organization_id_status_idx").on(
    table.organizationId,
    table.status,
  ),
  projectIdx: index("tasks_project_id_idx").on(table.projectId),
}));

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  taskIdx: index("comments_task_id_idx").on(table.taskId),
}));

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => ({
  tokenHashUnique: uniqueIndex("sessions_token_hash_unique").on(
    table.tokenHash,
  ),
  userIdx: index("sessions_user_id_idx").on(table.userId),
}));

// ---- relations (used for typed joins via Drizzle's query API) ----

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    memberships: many(memberships),
    projects: many(projects),
    owner: one(users, {
      fields: [organizations.ownerId],
      references: [users.id],
    }),
  }),
);

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [projects.organizationId],
    references: [organizations.id],
  }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  task: one(tasks, { fields: [comments.taskId], references: [tasks.id] }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
}));
