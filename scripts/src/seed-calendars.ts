import { db, calendarsTable, eventsTable } from "@workspace/db";

type SeedEvent = {
  calendarKey: string;
  title: string;
  description: string | null;
  location: string | null;
  startOffsetDays: number;
  startHour: number;
  durationHours: number;
  allDay?: boolean;
};

const calendars = [
  {
    key: "personal",
    name: "Personal",
    description: "Life outside of work — workouts, errands, evenings.",
    color: "#7C3AED",
    timezone: "America/Los_Angeles",
    owner: "You",
  },
  {
    key: "work",
    name: "Work",
    description: "Engineering team standups, reviews, and 1:1s.",
    color: "#0EA5E9",
    timezone: "America/Los_Angeles",
    owner: "Acme Studio",
  },
  {
    key: "team",
    name: "Design Crit",
    description: "Shared design critique and product reviews.",
    color: "#F97316",
    timezone: "America/Los_Angeles",
    owner: "Design Guild",
  },
  {
    key: "holidays",
    name: "Holidays",
    description: "US public holidays and observances.",
    color: "#16A34A",
    timezone: "UTC",
    owner: "United States",
  },
  {
    key: "birthdays",
    name: "Birthdays",
    description: "Friends and family birthdays.",
    color: "#E11D48",
    timezone: "America/Los_Angeles",
    owner: "Family & Friends",
  },
] as const;

const seedEvents: SeedEvent[] = [
  // Past week
  { calendarKey: "work", title: "Quarterly planning kickoff", description: "Aligning H1 roadmap with leadership.", location: "Boardroom A", startOffsetDays: -6, startHour: 10, durationHours: 2 },
  { calendarKey: "personal", title: "Long run", description: "10k along the waterfront.", location: "Embarcadero", startOffsetDays: -5, startHour: 7, durationHours: 1 },
  { calendarKey: "team", title: "Mobile redesign critique", description: "Round 2 of the new onboarding flow.", location: "Studio – East", startOffsetDays: -4, startHour: 14, durationHours: 1 },
  { calendarKey: "work", title: "1:1 with Priya", description: null, location: "Phone booth 3", startOffsetDays: -3, startHour: 11, durationHours: 1 },
  { calendarKey: "personal", title: "Pottery class", description: "Wheel throwing — bring apron.", location: "Clay Co. Studio", startOffsetDays: -2, startHour: 18, durationHours: 2 },

  // This week — including today
  { calendarKey: "work", title: "Team standup", description: "Daily sync.", location: "Zoom", startOffsetDays: 0, startHour: 9, durationHours: 1 },
  { calendarKey: "work", title: "Customer interview – Hana", description: "Discovery for the dashboard project.", location: "Google Meet", startOffsetDays: 0, startHour: 13, durationHours: 1 },
  { calendarKey: "personal", title: "Dentist", description: "Cleaning + checkup.", location: "Bright Smile Dental", startOffsetDays: 0, startHour: 16, durationHours: 1 },
  { calendarKey: "team", title: "Weekly design review", description: "Bring two screens for feedback.", location: "Studio – West", startOffsetDays: 1, startHour: 15, durationHours: 1 },
  { calendarKey: "work", title: "Engineering all-hands", description: "Quarterly engineering roundup.", location: "Auditorium", startOffsetDays: 2, startHour: 10, durationHours: 2 },
  { calendarKey: "personal", title: "Coffee with Marcus", description: "Catch up at Sightglass.", location: "Sightglass SoMa", startOffsetDays: 2, startHour: 8, durationHours: 1 },
  { calendarKey: "birthdays", title: "Lena's birthday", description: "She's turning 32.", location: null, startOffsetDays: 3, startHour: 0, durationHours: 24, allDay: true },
  { calendarKey: "work", title: "Sprint planning", description: null, location: "Boardroom B", startOffsetDays: 3, startHour: 13, durationHours: 2 },
  { calendarKey: "team", title: "Portfolio salon", description: "Bring a piece you want feedback on.", location: "The Loft", startOffsetDays: 4, startHour: 19, durationHours: 2 },
  { calendarKey: "personal", title: "Farmers market", description: "Pick up tomatoes and bread.", location: "Ferry Building", startOffsetDays: 5, startHour: 9, durationHours: 2 },

  // Next week
  { calendarKey: "work", title: "Design + engineering sync", description: null, location: "Zoom", startOffsetDays: 7, startHour: 11, durationHours: 1 },
  { calendarKey: "personal", title: "Movie night", description: "Whatever's playing at the Roxie.", location: "Roxie Theater", startOffsetDays: 8, startHour: 20, durationHours: 2 },
  { calendarKey: "work", title: "Quarterly review presentation", description: "Present Q1 results to the leadership team.", location: "Boardroom A", startOffsetDays: 9, startHour: 14, durationHours: 2 },
  { calendarKey: "holidays", title: "Memorial Day (observed)", description: "Federal holiday — office closed.", location: null, startOffsetDays: 10, startHour: 0, durationHours: 24, allDay: true },
  { calendarKey: "personal", title: "Hike Mt. Tam", description: "Bring water + snacks.", location: "Mount Tamalpais", startOffsetDays: 11, startHour: 8, durationHours: 5 },
  { calendarKey: "team", title: "Brand jam", description: "Working session on the new identity system.", location: "Studio – East", startOffsetDays: 12, startHour: 13, durationHours: 3 },
  { calendarKey: "birthdays", title: "Dad's birthday", description: "Call in the morning.", location: null, startOffsetDays: 13, startHour: 0, durationHours: 24, allDay: true },

  // Further out — week 3 / 4
  { calendarKey: "work", title: "Executive offsite", description: "All-day strategic planning offsite.", location: "Cavallo Point", startOffsetDays: 16, startHour: 0, durationHours: 24, allDay: true },
  { calendarKey: "personal", title: "Yoga retreat weekend", description: "Two-night retreat in the redwoods.", location: "Sea Ranch", startOffsetDays: 19, startHour: 0, durationHours: 48, allDay: true },
  { calendarKey: "team", title: "Annual portfolio show", description: "Studio open house.", location: "Studio – Main Hall", startOffsetDays: 22, startHour: 17, durationHours: 4 },
  { calendarKey: "work", title: "Hiring panel — design lead", description: "Three back-to-back interviews.", location: "Phone booth 1", startOffsetDays: 24, startHour: 10, durationHours: 3 },
  { calendarKey: "personal", title: "Anniversary dinner", description: "Reservation at State Bird.", location: "State Bird Provisions", startOffsetDays: 25, startHour: 19, durationHours: 2 },
];

async function main(): Promise<void> {
  console.log("Seeding calendars + events...");

  // Idempotent: clear and reseed
  await db.delete(eventsTable);
  await db.delete(calendarsTable);

  const inserted = await db
    .insert(calendarsTable)
    .values(
      calendars.map((c) => ({
        name: c.name,
        description: c.description,
        color: c.color,
        timezone: c.timezone,
        owner: c.owner,
      })),
    )
    .returning();

  const idByName = new Map<string, number>();
  inserted.forEach((row, i) => {
    idByName.set(calendars[i].key, row.id);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventRows = seedEvents.map((e) => {
    const calendarId = idByName.get(e.calendarKey);
    if (calendarId == null) {
      throw new Error(`Unknown calendar key: ${e.calendarKey}`);
    }

    const startAt = new Date(today);
    startAt.setDate(startAt.getDate() + e.startOffsetDays);
    startAt.setHours(e.startHour, 0, 0, 0);

    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + e.durationHours);

    return {
      calendarId,
      title: e.title,
      description: e.description,
      location: e.location,
      startAt,
      endAt,
      allDay: e.allDay ?? false,
    };
  });

  await db.insert(eventsTable).values(eventRows);

  console.log(
    `Seeded ${calendars.length} calendars and ${eventRows.length} events.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
