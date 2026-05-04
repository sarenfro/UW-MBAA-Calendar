import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const docFoldersTable = pgTable("doc_folders", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  parentFolderId: uuid("parent_folder_id").references(
    (): AnyPgColumn => docFoldersTable.id,
    { onDelete: "cascade" },
  ),
  createdBy: text("created_by").notNull(),
  restrictedEmails: text("restricted_emails").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DocFolder = typeof docFoldersTable.$inferSelect;
