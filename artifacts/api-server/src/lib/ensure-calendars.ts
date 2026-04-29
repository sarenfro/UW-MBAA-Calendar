import { db, calendarsTable } from "@workspace/db";
import { logger } from "./logger";

function googleIcsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

const CANONICAL_CALENDARS = [
  {
    name: "UW Foster Undergraduate Events",
    description: "Events from the UW Foster School of Business undergraduate calendar.",
    color: "#85754D",
    timezone: "America/Los_Angeles",
    owner: "UW Foster School of Business",
    subscriptionUrl: "https://www.trumba.com/calendars/sea_foster.ics",
    defaultHidden: true,
  },
  { name: "Business & Policy", description: "Business law, policy trends, and regulatory environment discussions.", color: "#1E40AF", timezone: "America/Los_Angeles", owner: "Business & Policy", subscriptionUrl: googleIcsUrl("umtkt80d79js17u12okdb98pug@group.calendar.google.com") },
  { name: "Career Management", description: "Career workshops, recruiting events, and job search resources.", color: "#0369A1", timezone: "America/Los_Angeles", owner: "UW Foster MBAA", subscriptionUrl: googleIcsUrl("ckpv907tn40jppjvbn9fejo4mo@group.calendar.google.com") },
  { name: "Challenge 4 Charity", description: "Annual charity competition events and fundraising activities.", color: "#DC2626", timezone: "America/Los_Angeles", owner: "Challenge 4 Charity", subscriptionUrl: googleIcsUrl("6a1gv8adbkbpcqc0vc9c264jd0@group.calendar.google.com") },
  { name: "Consulting Society", description: "Consulting case workshops, alumni panels, and networking events.", color: "#7C3AED", timezone: "America/Los_Angeles", owner: "Consulting Society", subscriptionUrl: googleIcsUrl("ifdqr2176anld3ftv97jao0a14@group.calendar.google.com") },
  { name: "Data & Analytics Club", description: "Data science workshops, analytics case studies, and industry talks.", color: "#0891B2", timezone: "America/Los_Angeles", owner: "Data & Analytics Club", subscriptionUrl: googleIcsUrl("gshjd39sflhj8sb9lqcg59mbbg@group.calendar.google.com") },
  { name: "Diversity in Business", description: "Events celebrating diversity, equity, and inclusion in business.", color: "#EA580C", timezone: "America/Los_Angeles", owner: "Diversity in Business", subscriptionUrl: googleIcsUrl("h1gu6epp0vo0qk71dlmko3gauc@group.calendar.google.com") },
  { name: "EVCC", description: "Entrepreneurship & Venture Capital Club events and speaker series.", color: "#15803D", timezone: "America/Los_Angeles", owner: "EVCC", subscriptionUrl: googleIcsUrl("0gg5h6lpg7i6enm8d55jms2vb8@group.calendar.google.com") },
  { name: "Finance Society", description: "Finance workshops, networking events, and industry speaker series.", color: "#059669", timezone: "America/Los_Angeles", owner: "Finance Society", subscriptionUrl: googleIcsUrl("uhj0s1l7j3cer94ril88r5e6m4@group.calendar.google.com") },
  { name: "Foster Creative", description: "Creative arts and design events within the Foster community.", color: "#D97706", timezone: "America/Los_Angeles", owner: "Foster Creative", subscriptionUrl: googleIcsUrl("doco30jk12bqeco4r2r8oqqup0@group.calendar.google.com") },
  { name: "Foster MBAA", description: "Official Foster MBA Association events and announcements.", color: "#4B2E83", timezone: "America/Los_Angeles", owner: "UW Foster MBAA", subscriptionUrl: googleIcsUrl("hbbp84mpp11jf1hjh0lgrqr3h4@group.calendar.google.com") },
  { name: "Foster Veterans Association", description: "Events and networking for student veterans at Foster.", color: "#991B1B", timezone: "America/Los_Angeles", owner: "Foster Veterans Association", subscriptionUrl: googleIcsUrl("r3nualb8i45lqo8jhi4kc83bq4@group.calendar.google.com") },
  { name: "Global Business Association", description: "International business events, cultural celebrations, and global career talks.", color: "#2563EB", timezone: "America/Los_Angeles", owner: "Global Business Association", subscriptionUrl: googleIcsUrl("1kuqaqjodofr2qosnkok657dcs@group.calendar.google.com") },
  { name: "Healthcare & Biotech Club", description: "Healthcare industry events, case competitions, and networking.", color: "#0D9488", timezone: "America/Los_Angeles", owner: "Healthcare & Biotech Club", subscriptionUrl: googleIcsUrl("r19gbe5p9sngqsb6ojd5tstfcs@group.calendar.google.com") },
  { name: "Level Up!", description: "Personal development workshops and skill-building events.", color: "#B45309", timezone: "America/Los_Angeles", owner: "Level Up!", subscriptionUrl: googleIcsUrl("ncqejqskulvq2t1oq4ikl91flo@group.calendar.google.com") },
  { name: "Marketing Association", description: "Marketing workshops, brand competitions, and industry speaker series.", color: "#E11D48", timezone: "America/Los_Angeles", owner: "Marketing Association", subscriptionUrl: googleIcsUrl("3ishaonfvjfnfn220gc3hkbiko@group.calendar.google.com") },
  { name: "MBA Huddle", description: "All-MBA community events, socials, and announcements.", color: "#6366F1", timezone: "America/Los_Angeles", owner: "UW Foster MBAA", subscriptionUrl: googleIcsUrl("iv1d7tlspq6bj5tlv84hfd3r1k@group.calendar.google.com") },
  { name: "MBACM", description: "Career Management program events, workshops, and recruiting.", color: "#8B5CF6", timezone: "America/Los_Angeles", owner: "UW Foster MBAA", subscriptionUrl: googleIcsUrl("3c012536e3756189e09891efbaaeda724cefcb0c0e860f26935623646af3124a@group.calendar.google.com") },
  { name: "Net Impact", description: "Sustainability, social impact, and corporate responsibility events.", color: "#16A34A", timezone: "America/Los_Angeles", owner: "Net Impact", subscriptionUrl: googleIcsUrl("7h5b604egcmh1gqrtkqncar9qc@group.calendar.google.com") },
  { name: "Operations Club", description: "Operations, supply chain, and process improvement events.", color: "#78350F", timezone: "America/Los_Angeles", owner: "Operations Club", subscriptionUrl: googleIcsUrl("4047afhvidsf7jklgslhur44ig@group.calendar.google.com") },
  { name: "Out in Business", description: "LGBTQ+ inclusive events, networking, and professional development.", color: "#EC4899", timezone: "America/Los_Angeles", owner: "Out in Business", subscriptionUrl: googleIcsUrl("baphjuktm8qn0qhrjjopml50fc@group.calendar.google.com") },
  { name: "Outdoor & Sports Industry Club", description: "Outdoor industry treks, speaker series, and adventure events.", color: "#65A30D", timezone: "America/Los_Angeles", owner: "Outdoor & Sports Industry Club", subscriptionUrl: googleIcsUrl("e4tmd1do9np12atu7hie0dsq5c@group.calendar.google.com") },
  { name: "Program Office", description: "Official program announcements, deadlines, and academic events.", color: "#6D28D9", timezone: "America/Los_Angeles", owner: "UW Foster MBAA", subscriptionUrl: googleIcsUrl("fef4c2vnm1nfjmirha7730fdn0@group.calendar.google.com") },
  { name: "Strategy Club", description: "Strategy case workshops, competitions, and industry discussions.", color: "#1D4ED8", timezone: "America/Los_Angeles", owner: "Strategy Club", subscriptionUrl: googleIcsUrl("btpa5raf4mco0gboutomt2gihs@group.calendar.google.com") },
  { name: "Student Affairs", description: "Campus life events, student resources, and community programming.", color: "#BE185D", timezone: "America/Los_Angeles", owner: "UW Foster MBAA", subscriptionUrl: googleIcsUrl("macbl8tshkos5p7srlk9n5ubjo@group.calendar.google.com") },
  { name: "Tech Club", description: "Technology industry events, hackathons, and startup discussions.", color: "#0F766E", timezone: "America/Los_Angeles", owner: "Tech Club", subscriptionUrl: googleIcsUrl("haqa40tsmp6emhv27u362fgvbk@group.calendar.google.com") },
  { name: "Wellness", description: "Wellness workshops, mindfulness events, and health-focused programming.", color: "#84CC16", timezone: "America/Los_Angeles", owner: "Wellness", subscriptionUrl: googleIcsUrl("qpdt3k9u7hrke17si6ku8ui1ls@group.calendar.google.com") },
  { name: "Wine Club", description: "Wine tastings, vineyard visits, and oenology education events.", color: "#7E22CE", timezone: "America/Los_Angeles", owner: "Wine Club", subscriptionUrl: googleIcsUrl("ocfd5o3r7jd8bd5vpr7c7vqkfo@group.calendar.google.com") },
  { name: "Women in Business", description: "Events supporting women in leadership and professional development.", color: "#C026D3", timezone: "America/Los_Angeles", owner: "Women in Business", subscriptionUrl: googleIcsUrl("16gi343a3rpoavgf2na49ust90@group.calendar.google.com") },
] as const;

export async function ensureCalendars(): Promise<void> {
  const existing = await db
    .select({ subscriptionUrl: calendarsTable.subscriptionUrl })
    .from(calendarsTable);

  const existingUrls = new Set(existing.map((r) => r.subscriptionUrl));

  const missing = CANONICAL_CALENDARS.filter(
    (c) => !existingUrls.has(c.subscriptionUrl),
  );

  if (missing.length === 0) {
    logger.info("ensureCalendars: all calendars present");
    return;
  }

  await db.insert(calendarsTable).values(
    missing.map((c) => ({
      name: c.name,
      description: c.description,
      color: c.color,
      timezone: c.timezone,
      owner: c.owner,
      subscriptionUrl: c.subscriptionUrl,
      defaultHidden: "defaultHidden" in c ? c.defaultHidden : false,
    })),
  );

  logger.info(
    { inserted: missing.map((c) => c.name) },
    `ensureCalendars: inserted ${missing.length} missing calendar(s)`,
  );
}
