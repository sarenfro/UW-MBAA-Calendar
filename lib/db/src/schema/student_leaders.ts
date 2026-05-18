import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const studentLeadersTable = pgTable("student_leaders", {
  id: serial("id").primaryKey(),
  quarter: text("quarter").notNull(),
  status: text("status").notNull().default("nominations_open"),
  winnerName: text("winner_name"),
  winnerClub: text("winner_club"),
  winnerProgram: text("winner_program"),
  winnerBio: text("winner_bio"),
  winnerPhotoUrl: text("winner_photo_url"),
  nominatedBy: text("nominated_by"),
  reason: text("reason"),
  isCurrent: boolean("is_current").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StudentLeader = typeof studentLeadersTable.$inferSelect;
