import { db, membersTable } from "@workspace/db";

const members = [
  {
    name: "Amara Osei",
    email: "aosei@uw.edu",
    graduationYear: 2026,
    track: "Finance",
    committee: "Finance Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Ben Nakamura",
    email: "bnakamura@uw.edu",
    graduationYear: 2026,
    track: "Marketing",
    committee: "Events Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Chloe Reyes",
    email: "creyes@uw.edu",
    graduationYear: 2026,
    track: "Strategy & Leadership",
    committee: "Recruiting Committee",
    duesPaid: false,
    notes: "Reach out re: dues",
  },
  {
    name: "Daniel Kim",
    email: "dkim@uw.edu",
    graduationYear: 2026,
    track: "Technology & Analytics",
    committee: "Tech Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Elena Vasquez",
    email: "evasquez@uw.edu",
    graduationYear: 2026,
    track: "General Management",
    committee: "Social Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Finn O'Brien",
    email: "fobrien@uw.edu",
    graduationYear: 2026,
    track: "Operations & Supply Chain",
    committee: "Events Committee",
    duesPaid: false,
    notes: null,
  },
  {
    name: "Grace Liu",
    email: "gliu@uw.edu",
    graduationYear: 2026,
    track: "Finance",
    committee: "Finance Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Hassan Ahmed",
    email: "hahmed@uw.edu",
    graduationYear: 2026,
    track: "Entrepreneurship",
    committee: "EVCC Liaison",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Isabel Torres",
    email: "itorres@uw.edu",
    graduationYear: 2026,
    track: "Marketing",
    committee: "Community Service",
    duesPaid: false,
    notes: null,
  },
  {
    name: "James Whitfield",
    email: "jwhitfield@uw.edu",
    graduationYear: 2026,
    track: "Strategy & Leadership",
    committee: "Alumni Relations",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Keiko Tanaka",
    email: "ktanaka@uw.edu",
    graduationYear: 2026,
    track: "Technology & Analytics",
    committee: "Tech Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Luca Ferraro",
    email: "lferraro@uw.edu",
    graduationYear: 2026,
    track: "General Management",
    committee: "Events Committee",
    duesPaid: false,
    notes: "Deferred — confirmed intent to pay",
  },
  {
    name: "Maya Johnson",
    email: "mjohnson@uw.edu",
    graduationYear: 2026,
    track: "Finance",
    committee: "Finance Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Nate Patel",
    email: "npatel@uw.edu",
    graduationYear: 2026,
    track: "Entrepreneurship",
    committee: "Recruiting Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Olivia Chen",
    email: "ochen@uw.edu",
    graduationYear: 2026,
    track: "Operations & Supply Chain",
    committee: "Social Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Pedro Alves",
    email: "palves@uw.edu",
    graduationYear: 2026,
    track: "Marketing",
    committee: "Community Service",
    duesPaid: false,
    notes: null,
  },
  {
    name: "Quinn Harrington",
    email: "qharrington@uw.edu",
    graduationYear: 2026,
    track: "Strategy & Leadership",
    committee: "Alumni Relations",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Riya Sharma",
    email: "rsharma@uw.edu",
    graduationYear: 2026,
    track: "Finance",
    committee: "Finance Committee",
    duesPaid: true,
    notes: null,
  },
  {
    name: "Sam Westbrook",
    email: "swestbrook@uw.edu",
    graduationYear: 2026,
    track: "Technology & Analytics",
    committee: "Tech Committee",
    duesPaid: false,
    notes: "On leave spring quarter",
  },
  {
    name: "Tiana Brooks",
    email: "tbrooks@uw.edu",
    graduationYear: 2026,
    track: "General Management",
    committee: "Events Committee",
    duesPaid: true,
    notes: null,
  },
] as const;

async function main(): Promise<void> {
  console.log("Seeding MBAA members...");

  await db.delete(membersTable);

  await db.insert(membersTable).values(
    members.map((m) => ({
      name: m.name,
      email: m.email,
      graduationYear: m.graduationYear,
      track: m.track,
      committee: m.committee,
      duesPaid: m.duesPaid,
      notes: m.notes ?? null,
    })),
  );

  console.log(`Seeded ${members.length} members.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
