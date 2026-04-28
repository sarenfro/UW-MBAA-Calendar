import {
  pgTable,
  text,
  uuid,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { membersTable } from "./members";
import { clubsTable } from "./clubs";

export const membershipsTable = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => membersTable.id, { onDelete: "cascade" }),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubsTable.id, { onDelete: "cascade" }),
    termYears: integer("term_years").notNull(),
    // PostgreSQL numeric returns as string; callers must parse to number.
    amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    academicYear: text("academic_year").notNull(),
    orderRef: text("order_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("memberships_member_id_idx").on(table.memberId),
    index("memberships_club_id_idx").on(table.clubId),
    index("memberships_club_year_idx").on(table.clubId, table.academicYear),
  ],
);

export const insertMembershipSchema = createInsertSchema(membershipsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof membershipsTable.$inferSelect;
