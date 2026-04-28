import { db, calendarsTable, eventsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── ICS parser ───────────────────────────────────────────────────────────────

type IcsEvent = {
  summary: string;
  description: string | null;
  location: string | null;
  dtstart: Date;
  dtend: Date;
  allDay: boolean;
};

function unfold(raw: string): string {
  // RFC 5545: continuation lines start with a single space or tab
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

// Converts a local date/time string in the given IANA timezone to a UTC Date.
function localToUtc(value: string, tzid: string): Date {
  const y = parseInt(value.slice(0, 4));
  const mo = parseInt(value.slice(4, 6)) - 1;
  const d = parseInt(value.slice(6, 8));
  const h = parseInt(value.slice(9, 11));
  const mi = parseInt(value.slice(11, 13));
  const s = parseInt(value.slice(13, 15));

  // Treat the local time as if it were UTC to get a reference point
  const assumed = new Date(Date.UTC(y, mo, d, h, mi, s));

  // Find what that reference UTC moment looks like in the target timezone
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
  const tzH = get("hour") % 24; // Intl may return 24 for midnight
  const tzMi = get("minute");
  const tzS = get("second");

  // Shift: (target local) – (what assumed maps to in tz) = timezone offset
  const diff =
    Date.UTC(y, mo, d, h, mi, s) - Date.UTC(tzY, tzMo, tzD, tzH, tzMi, tzS);
  return new Date(assumed.getTime() + diff);
}

function parseIcsDate(
  value: string,
  params: Record<string, string>,
): { date: Date; allDay: boolean } {
  // All-day: VALUE=DATE or bare YYYYMMDD
  if (params["VALUE"] === "DATE" || /^\d{8}$/.test(value)) {
    const y = parseInt(value.slice(0, 4));
    const mo = parseInt(value.slice(4, 6)) - 1;
    const dv = parseInt(value.slice(6, 8));
    return { date: new Date(Date.UTC(y, mo, dv)), allDay: true };
  }

  // UTC: YYYYMMDDTHHmmssZ
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

  // Local time with TZID
  const tzid = params["TZID"] ?? "UTC";
  return { date: localToUtc(value, tzid), allDay: false };
}

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
    hasRrule?: boolean;
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
      // Skip cancelled events and events with no dates
      if (
        cur.dtstart &&
        cur.dtend &&
        cur.status !== "CANCELLED"
      ) {
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
      case "SUMMARY":
        cur.summary = unescapeText(value);
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(value).trim() || undefined;
        break;
      case "LOCATION":
        cur.location = unescapeText(value).trim() || undefined;
        break;
      case "DTSTART": {
        const { date, allDay } = parseIcsDate(value, params);
        cur.dtstart = date;
        cur.allDay = allDay;
        break;
      }
      case "DTEND": {
        cur.dtend = parseIcsDate(value, params).date;
        break;
      }
      case "DURATION": {
        // Some all-day events use DURATION instead of DTEND
        if (cur.dtstart && !cur.dtend) {
          const match = value.match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
          if (match) {
            const weeks = parseInt(match[1] ?? "0");
            const days = parseInt(match[2] ?? "0");
            const hours = parseInt(match[3] ?? "0");
            const mins = parseInt(match[4] ?? "0");
            const secs = parseInt(match[5] ?? "0");
            const ms =
              ((weeks * 7 + days) * 24 * 60 * 60 +
                hours * 60 * 60 +
                mins * 60 +
                secs) *
              1000;
            cur.dtend = new Date(cur.dtstart.getTime() + ms);
          }
        }
        break;
      }
      case "STATUS":
        cur.status = value.toUpperCase();
        break;
      case "RRULE":
        cur.hasRrule = true;
        break;
    }
  }

  return events;
}

// ── Sync logic ────────────────────────────────────────────────────────────────

async function syncCalendar(
  calendarId: number,
  name: string,
  url: string,
): Promise<number> {
  let raw: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "UW-MBAA-Calendar-Sync/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`  SKIP ${name}: HTTP ${res.status}`);
      return 0;
    }
    raw = await res.text();
  } catch (err) {
    console.warn(`  SKIP ${name}: ${(err as Error).message}`);
    return 0;
  }

  const events = parseIcs(raw);

  // Replace all events for this calendar
  await db.delete(eventsTable).where(eq(eventsTable.calendarId, calendarId));

  if (events.length === 0) {
    console.log(`  ${name}: 0 events`);
    return 0;
  }

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

  console.log(`  ${name}: ${events.length} events`);
  return events.length;
}

async function main(): Promise<void> {
  console.log("Syncing calendars from Google Calendar ICS feeds...\n");

  const calendars = await db.select().from(calendarsTable);
  const withUrl = calendars.filter((c) => c.subscriptionUrl);

  if (withUrl.length === 0) {
    console.log("No calendars with subscription URLs. Run seed-calendars first.");
    return;
  }

  let totalEvents = 0;
  for (const cal of withUrl) {
    const count = await syncCalendar(cal.id, cal.name, cal.subscriptionUrl!);
    totalEvents += count;
  }

  console.log(
    `\nDone. ${totalEvents} events across ${withUrl.length} calendars.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
