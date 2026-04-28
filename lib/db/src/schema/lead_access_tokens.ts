import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { clubLeadsTable } from "./club_leads";

export const leadAccessTokensTable = pgTable("lead_access_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  clubLeadId: uuid("club_lead_id")
    .notNull()
    .references(() => clubLeadsTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LeadAccessToken = typeof leadAccessTokensTable.$inferSelect;
