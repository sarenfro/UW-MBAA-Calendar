import type { Calendar, Event } from "@workspace/db";

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatUtc(date: Date): string {
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

function formatAllDay(date: Date): string {
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}`
  );
}

function escapeText(value: string | null | undefined): string {
  if (value == null) return "";
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  chunks.push(line.slice(0, 75));
  i = 75;
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join("\r\n");
}

export function buildIcs(event: Event, calendar: Calendar): string {
  const dtstamp = formatUtc(new Date());
  const uid = `event-${event.id}@calendar-dashboard`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Calendar Dashboard//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendar.name)}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatAllDay(event.startAt)}`);
    lines.push(`DTEND;VALUE=DATE:${formatAllDay(event.endAt)}`);
  } else {
    lines.push(`DTSTART:${formatUtc(event.startAt)}`);
    lines.push(`DTEND:${formatUtc(event.endAt)}`);
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }
  lines.push(`CATEGORIES:${escapeText(calendar.name)}`);
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "event";
}
