import { Router, type IRouter } from "express";
import { and, asc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { db, calendarsTable, eventsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

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

export default router;
