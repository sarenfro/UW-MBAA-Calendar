import { Router, type IRouter } from "express";
import { and, asc, eq, gte, inArray, lt, gt } from "drizzle-orm";
import { db, calendarsTable, eventsTable } from "@workspace/db";
import type { Calendar, Event } from "@workspace/db";
import {
  ListEventsQueryParams,
  ListEventsResponse,
  GetEventParams,
  GetEventResponse,
  ListUpcomingEventsQueryParams,
  ListUpcomingEventsResponse,
} from "@workspace/api-zod";
import { buildIcs, slugify } from "../lib/ics";

const router: IRouter = Router();

type EventRow = { events: Event; calendars: Calendar };

function shapeEvent(row: EventRow) {
  const e = row.events;
  return {
    id: e.id,
    calendarId: e.calendarId,
    title: e.title,
    description: e.description,
    location: e.location,
    startAt: e.startAt,
    endAt: e.endAt,
    allDay: e.allDay,
    calendar: row.calendars,
  };
}

router.get("/events/upcoming", async (req, res): Promise<void> => {
  const parsed = ListUpcomingEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const limit = parsed.data.limit ?? 8;
  const now = new Date();
  const rows = await db
    .select()
    .from(eventsTable)
    .innerJoin(calendarsTable, eq(eventsTable.calendarId, calendarsTable.id))
    .where(gt(eventsTable.endAt, now))
    .orderBy(asc(eventsTable.startAt))
    .limit(limit);

  res.json(ListUpcomingEventsResponse.parse(rows.map(shapeEvent)));
});

router.get("/events", async (req, res): Promise<void> => {
  const rawStart = typeof req.query.start === "string" ? req.query.start : "";
  const rawEnd = typeof req.query.end === "string" ? req.query.end : "";
  const startDate = new Date(rawStart);
  const endDate = new Date(rawEnd);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    res.status(400).json({ error: "start and end must be valid ISO date-time strings" });
    return;
  }

  const parsed = ListEventsQueryParams.safeParse({
    start: startDate,
    end: endDate,
    calendarIds: req.query.calendarIds,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { start, end, calendarIds } = parsed.data;
  const conditions = [
    gte(eventsTable.startAt, start),
    lt(eventsTable.startAt, end),
  ];

  if (calendarIds && calendarIds.trim().length > 0) {
    const ids = calendarIds
      .split(",")
      .map((v) => parseInt(v, 10))
      .filter((v) => Number.isInteger(v) && v > 0);
    if (ids.length > 0) {
      conditions.push(inArray(eventsTable.calendarId, ids));
    }
  }

  const rows = await db
    .select()
    .from(eventsTable)
    .innerJoin(calendarsTable, eq(eventsTable.calendarId, calendarsTable.id))
    .where(and(...conditions))
    .orderBy(asc(eventsTable.startAt));

  res.json(ListEventsResponse.parse(rows.map(shapeEvent)));
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(eventsTable)
    .innerJoin(calendarsTable, eq(eventsTable.calendarId, calendarsTable.id))
    .where(eq(eventsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.json(GetEventResponse.parse(shapeEvent(row)));
});

router.get("/events/:id/ics", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(eventsTable)
    .innerJoin(calendarsTable, eq(eventsTable.calendarId, calendarsTable.id))
    .where(eq(eventsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const ics = buildIcs(row.events, row.calendars);
  const filename = `${slugify(row.events.title)}.ics`;

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  res.send(ics);
});

export default router;
