import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gt, gte, lt, sql } from "drizzle-orm";
import {
  db,
  calendarsTable,
  clubsTable,
  eventsTable,
  membershipsTable,
} from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { academicYearFor } from "../lib/academic-year";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const startOfNextWeek = new Date(startOfToday);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

  const [{ count: totalCalendars }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(calendarsTable);

  const [{ count: totalEvents }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventsTable);

  const [{ count: eventsToday }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.startAt, startOfToday),
        lt(eventsTable.startAt, startOfTomorrow),
      ),
    );

  const [{ count: eventsThisWeek }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.startAt, startOfToday),
        lt(eventsTable.startAt, startOfNextWeek),
      ),
    );

  const nextEventRows = await db
    .select()
    .from(eventsTable)
    .innerJoin(calendarsTable, eq(eventsTable.calendarId, calendarsTable.id))
    .where(gt(eventsTable.endAt, now))
    .orderBy(asc(eventsTable.startAt))
    .limit(1);

  const nextEvent = nextEventRows[0]
    ? {
        id: nextEventRows[0].events.id,
        calendarId: nextEventRows[0].events.calendarId,
        title: nextEventRows[0].events.title,
        description: nextEventRows[0].events.description,
        location: nextEventRows[0].events.location,
        startAt: nextEventRows[0].events.startAt,
        endAt: nextEventRows[0].events.endAt,
        allDay: nextEventRows[0].events.allDay,
        calendar: nextEventRows[0].calendars,
      }
    : null;

  const calendars = await db
    .select()
    .from(calendarsTable)
    .orderBy(calendarsTable.id);

  const breakdownRows = await Promise.all(
    calendars.map(async (cal) => {
      const [{ eventCount }] = await db
        .select({ eventCount: sql<number>`cast(count(*) as int)` })
        .from(eventsTable)
        .where(eq(eventsTable.calendarId, cal.id));
      const [{ upcomingCount }] = await db
        .select({ upcomingCount: sql<number>`cast(count(*) as int)` })
        .from(eventsTable)
        .where(
          and(eq(eventsTable.calendarId, cal.id), gt(eventsTable.endAt, now)),
        );
      return {
        calendar: cal,
        eventCount,
        upcomingCount,
      };
    }),
  );

  res.json(
    GetDashboardSummaryResponse.parse({
      totalCalendars,
      totalEvents,
      eventsToday,
      eventsThisWeek,
      nextEvent,
      breakdown: breakdownRows,
    }),
  );
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/membership-summary
// MBAA-wide top-of-page membership stats for the current academic year.
// ---------------------------------------------------------------------------
router.get("/dashboard/membership-summary", async (req, res): Promise<void> => {
  const now = new Date();
  const currentYear = academicYearFor(now);

  const [{ totalActiveMembers }] = await db
    .select({
      totalActiveMembers: sql<number>`cast(count(distinct ${membershipsTable.memberId}) as int)`,
    })
    .from(membershipsTable)
    .where(gt(membershipsTable.expiresAt, now));

  const [{ totalDuesCollected }] = await db
    .select({
      totalDuesCollected: sql<string>`coalesce(sum(${membershipsTable.amountPaid}), '0')`,
    })
    .from(membershipsTable)
    .where(eq(membershipsTable.academicYear, currentYear));

  const [{ activeClubCount }] = await db
    .select({
      activeClubCount: sql<number>`cast(count(*) as int)`,
    })
    .from(clubsTable)
    .where(eq(clubsTable.isActive, true));

  const topClubRows = await db
    .select({
      clubId: membershipsTable.clubId,
      clubName: clubsTable.name,
      clubSlug: clubsTable.slug,
      memberCount: sql<number>`cast(count(distinct ${membershipsTable.memberId}) as int)`,
    })
    .from(membershipsTable)
    .innerJoin(clubsTable, eq(membershipsTable.clubId, clubsTable.id))
    .where(eq(membershipsTable.academicYear, currentYear))
    .groupBy(membershipsTable.clubId, clubsTable.name, clubsTable.slug)
    .orderBy(desc(sql`count(distinct ${membershipsTable.memberId})`))
    .limit(5);

  res.json({
    currentAcademicYear: currentYear,
    totalActiveMembers,
    totalDuesCollected: parseFloat(totalDuesCollected),
    activeClubCount,
    topClubs: topClubRows,
  });
});

export default router;
