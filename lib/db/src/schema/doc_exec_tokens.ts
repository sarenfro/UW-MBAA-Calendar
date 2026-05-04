import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const docExecTokensTable = pgTable("doc_exec_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DocExecToken = typeof docExecTokensTable.$inferSelect;
