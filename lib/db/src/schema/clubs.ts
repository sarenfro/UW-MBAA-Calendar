import { pgTable, text, uuid, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// calendar_id is integer, not uuid, because calendars.id is a serial integer.
// The brief specified uuid but the FK target type must match the source.
export const clubsTable = pgTable("clubs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  calendarId: integer("calendar_id"),
  isActive: boolean("is_active").notNull().default(true),
  pricing: jsonb("pricing").$type<Record<string, number>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClubSchema = createInsertSchema(clubsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Club = typeof clubsTable.$inferSelect;
