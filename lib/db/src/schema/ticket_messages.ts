import { pgTable, text, uuid, boolean, timestamp } from "drizzle-orm/pg-core";
import { ticketsTable } from "./tickets";

export const ticketMessagesTable = pgTable("ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => ticketsTable.id, { onDelete: "cascade" }),
  senderEmail: text("sender_email").notNull(),
  senderName: text("sender_name").notNull(),
  isVp: boolean("is_vp").notNull().default(false),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TicketMessage = typeof ticketMessagesTable.$inferSelect;
