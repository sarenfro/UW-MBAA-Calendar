import { pgTable, text, uuid, integer, timestamp, customType } from "drizzle-orm/pg-core";
import { docFoldersTable } from "./doc_folders";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
  toDriver(value: Buffer): Buffer {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
  fromDriver(value: Buffer): Buffer {
    return Buffer.isBuffer(value) ? value : Buffer.from(value as unknown as ArrayBuffer);
  },
});

export const docFilesTable = pgTable("doc_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  folderId: uuid("folder_id").references(() => docFoldersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  content: bytea("content").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mime_type").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  lastModifiedBy: text("last_modified_by").notNull(),
  lastModifiedAt: timestamp("last_modified_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DocFile = typeof docFilesTable.$inferSelect;
export type DocFileMeta = Omit<DocFile, "content">;
