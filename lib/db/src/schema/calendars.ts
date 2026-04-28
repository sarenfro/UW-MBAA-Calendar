import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const calendarsTable = pgTable("calendars", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull(),
  timezone: text("timezone").notNull().default("UTC"),
  owner: text("owner").notNull(),
  subscriptionUrl: text("subscription_url"),
});

export const insertCalendarSchema = createInsertSchema(calendarsTable).omit({
  id: true,
});
export type InsertCalendar = z.infer<typeof insertCalendarSchema>;
export type Calendar = typeof calendarsTable.$inferSelect;
