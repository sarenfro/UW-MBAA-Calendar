import { pgTable, pgEnum, text, uuid, timestamp } from "drizzle-orm/pg-core";

export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "resolved"]);
export const ticketCategoryEnum = pgEnum("ticket_category", [
  "general",
  "technology",
  "event",
  "financial",
  "other",
]);

export const ticketsTable = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: ticketCategoryEnum("category").notNull().default("general"),
  status: ticketStatusEnum("status").notNull().default("open"),
  submitterEmail: text("submitter_email").notNull(),
  submitterName: text("submitter_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Ticket = typeof ticketsTable.$inferSelect;
export type TicketStatus = "open" | "in_progress" | "resolved";
export type TicketCategory = "general" | "technology" | "event" | "financial" | "other";
