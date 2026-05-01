import { db, calendarsTable, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

function unfold(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function unescapeText(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseProp(line: string): {
  name: string;
  params: Record<string, string>;
  value: string;
} {
  const colon = line.indexOf(":");
  if (colon === -1) return { name: line, params: {}, value: "" };
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const eqIdx = p.indexOf("=");
    if (eqIdx !== -1) params[p.slice(0, eqIdx)] = p.slice(eqIdx + 1);
  }
  return { name, params, value };
}

function localToUtc(value: string, tzid: string): Date {
  const y = parseInt(value.slice(0, 4));
  const mo = parseInt(value.slice(4, 6)) - 1;
  const d = parseInt(value.slice(6, 8));
  const h = parseInt(value.slice(9, 11));
  const mi = parseInt(value.slice(11, 13));
  const s = parseInt(value.slice(13, 15));
  const assumed = new Date(Date.UTC(y, mo, d, h, mi, s));
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tzid,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(assumed);
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0");
  const tzY = get("year");
  const tzMo = get("month") - 1;
  const tzD = get("day");
  const tzH = get("hour") % 24;
  const tzMi = get("minute");
  const tzS = get("second");
  const diff =
    Date.UTC(y, mo, d, h, mi, s) - Date.UTC(tzY, tzMo, tzD, tzH, tzMi, tzS);
  return new Date(assumed.getTime() + diff);
}

function parseIcsDate(
  value: string,
  params: Record<string, string>,
): { date: Date; allDay: boolean } {
  if (params["VALUE"] === "DATE" || /^\d{8}$/.test(value)) {
    const y = parseInt(value.slice(0, 4));
    const mo = parseInt(value.slice(4, 6)) - 1;
    const dv = parseInt(value.slice(6, 8));
    return { date: new Date(Date.UTC(y, mo, dv)), allDay: true };
  }
  if (value.endsWith("Z")) {
    const y = value.slice(0, 4);
    const mo = value.slice(4, 6);
    const dv = value.slice(6, 8);
    const h = value.slice(9, 11);
    const mi = value.slice(11, 13);
    const sv = value.slice(13, 15);
    return {
      date: new Date(`${y}-${mo}-${dv}T${h}:${mi}:${sv}Z`),
      allDay: false,
    };
  }
  const tzid = params["TZID"] ?? "UTC";
  return { date: localToUtc(value, tzid), allDay: false };
}

type IcsEvent = {
  summary: string;
  description: string | null;
  location: string | null;
  dtstart: Date;
  dtend: Date;
  allDay: boolean;
};

function parseIcs(raw: string): IcsEvent[] {
  const lines = unfold(raw).split(/\r?\n/);
  const events: IcsEvent[] = [];
  let inEvent = false;
  let cur: {
    summary?: string;
    description?: string;
    location?: string;
    dtstart?: Date;
    dtend?: Date;
    allDay?: boolean;
    status?: string;
  } = {};

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (cur.dtstart && cur.dtend && cur.status !== "CANCELLED") {
        events.push({
          summary: cur.summary ?? "(No title)",
          description: cur.description ?? null,
          location: cur.location ?? null,
          dtstart: cur.dtstart,
          dtend: cur.dtend,
          allDay: cur.allDay ?? false,
        });
      }
      continue;
    }
    if (!inEvent) continue;
    const { name, params, value } = parseProp(line);
    switch (name) {
      case "SUMMARY": cur.summary = unescapeText(value); break;
      case "DESCRIPTION": cur.description = unescapeText(value).trim() || undefined; break;
      case "LOCATION": cur.location = unescapeText(value).trim() || undefined; break;
      case "DTSTART": { const { date, allDay } = parseIcsDate(value, params); cur.dtstart = date; cur.allDay = allDay; break; }
      case "DTEND": { cur.dtend = parseIcsDate(value, params).date; break; }
      case "DURATION": {
        if (cur.dtstart && !cur.dtend) {
          const match = value.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
          if (match) {
            const weeks = parseInt(match[1] ?? "0");
            const days = parseInt(match[2] ?? "0");
            const hours = parseInt(match[3] ?? "0");
            const mins = parseInt(match[4] ?? "0");
            const secs = parseInt(match[5] ?? "0");
            const ms = ((weeks * 7 + days) * 24 * 60 * 60 + hours * 60 * 60 + mins * 60 + secs) * 1000;
            cur.dtend = new Date(cur.dtstart.getTime() + ms);
          }
        }
        break;
      }
      case "STATUS": cur.status = value.toUpperCase(); break;
    }
  }
  return events;
}

export type SyncResult = {
  calendar: string;
  events: number;
  skipped?: boolean;
  error?: string;
};

async function syncOne(
  calendarId: number,
  name: string,
  url: string,
): Promise<SyncResult> {
  let raw: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "UW-MBAA-Calendar-Sync/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return { calendar: name, events: 0, skipped: true, error: `HTTP ${res.status}` };
    }
    raw = await res.text();
  } catch (err) {
    return { calendar: name, events: 0, skipped: true, error: (err as Error).message };
  }

  const events = parseIcs(raw);
  await db.delete(eventsTable).where(eq(eventsTable.calendarId, calendarId));
  if (events.length > 0) {
    await db.insert(eventsTable).values(
      events.map((e) => ({
        calendarId,
        title: e.summary,
        description: e.description ?? null,
        location: e.location ?? null,
        startAt: e.dtstart,
        endAt: e.dtend,
        allDay: e.allDay,
      })),
    );
  }
  return { calendar: name, events: events.length };
}

export async function syncAllCalendars(): Promise<SyncResult[]> {
  const calendars = await db.select().from(calendarsTable);
  const withUrl = calendars.filter((c) => c.subscriptionUrl);
  const results: SyncResult[] = [];
  for (const cal of withUrl) {
    const result = await syncOne(cal.id, cal.name, cal.subscriptionUrl!);
    results.push(result);
    logger.info({ calendar: cal.name, events: result.events, skipped: result.skipped }, "syncCalendars: calendar synced");
  }
  return results;
}
