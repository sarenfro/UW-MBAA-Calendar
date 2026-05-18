import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { studentLeadersTable } from "./student_leaders";

export const studentLeaderNominationsTable = pgTable("student_leader_nominations", {
  id: serial("id").primaryKey(),
  quarterId: integer("quarter_id")
    .notNull()
    .references(() => studentLeadersTable.id),
  nominatorName: text("nominator_name").notNull(),
  nominatorEmail: text("nominator_email").notNull(),
  nominatorClass: text("nominator_class"),
  nomineeName: text("nominee_name").notNull(),
  nomineeClass: text("nominee_class").notNull(),
  leadershipReason: text("leadership_reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type StudentLeaderNomination = typeof studentLeaderNominationsTable.$inferSelect;
