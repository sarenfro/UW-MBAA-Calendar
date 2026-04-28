import { pgTable, uuid, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { membersTable } from "./members";
import { clubsTable } from "./clubs";

export const clubLeadsTable = pgTable(
  "club_leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("club_leads_club_member_unique").on(table.clubId, table.memberId),
  ],
);

export type ClubLead = typeof clubLeadsTable.$inferSelect;
