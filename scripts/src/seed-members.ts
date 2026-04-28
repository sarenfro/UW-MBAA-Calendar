import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db, clubsTable, membersTable, membershipsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Seed data was pre-filtered to class of 2027 and 2028 only.
// Do not add class-year filtering here.
const raw = readFileSync(
  join(__dirname, "../data/membership-seed.json"),
  "utf-8",
);

interface SeedClub {
  name: string;
  slug: string;
  description: string | null;
  pricing: Record<string, number>;
}

interface SeedMember {
  email: string;
  fullName: string;
  program: "full_time" | "evening";
  classYear: number;
}

interface SeedMembership {
  memberEmail: string;
  clubSlug: string;
  termYears: number;
  amountPaid: number;
  paidAt: string;
  academicYear: string;
  orderRef: string | null;
}

interface SeedData {
  clubs: SeedClub[];
  members: SeedMember[];
  memberships: SeedMembership[];
}

const seed = JSON.parse(raw) as SeedData;

async function main(): Promise<void> {
  console.log("Seeding membership data...");

  // 1. Upsert clubs by slug
  const upsertedClubs = await db
    .insert(clubsTable)
    .values(
      seed.clubs.map((c) => ({
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        pricing: c.pricing,
        isActive: true,
      })),
    )
    .onConflictDoUpdate({
      target: clubsTable.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        pricing: sql`excluded.pricing`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: clubsTable.id, slug: clubsTable.slug });

  const clubsBySlug = new Map<string, string>(
    upsertedClubs.map((c) => [c.slug, c.id]),
  );

  // 2. Upsert members by email
  const upsertedMembers = await db
    .insert(membersTable)
    .values(
      seed.members.map((m) => ({
        email: m.email,
        fullName: m.fullName,
        program: m.program,
        classYear: m.classYear,
      })),
    )
    .onConflictDoUpdate({
      target: membersTable.email,
      set: {
        fullName: sql`excluded.full_name`,
        program: sql`excluded.program`,
        classYear: sql`excluded.class_year`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ id: membersTable.id, email: membersTable.email });

  const membersByEmail = new Map<string, string>(
    upsertedMembers.map((m) => [m.email, m.id]),
  );

  // 3. Load existing memberships for idempotency check on (member_id, club_id, paid_at)
  const existing = await db
    .select({
      memberId: membershipsTable.memberId,
      clubId: membershipsTable.clubId,
      paidAt: membershipsTable.paidAt,
    })
    .from(membershipsTable);

  const existingKeys = new Set<string>(
    existing.map((r) => `${r.memberId}:${r.clubId}:${r.paidAt.toISOString()}`),
  );

  // 4. Resolve and deduplicate memberships to insert
  const toInsert: {
    memberId: string;
    clubId: string;
    termYears: number;
    amountPaid: string;
    paidAt: Date;
    expiresAt: Date;
    academicYear: string;
    orderRef: string | null;
  }[] = [];

  let skipped = 0;
  let missingMember = 0;
  let missingClub = 0;

  for (const ms of seed.memberships) {
    const memberId = membersByEmail.get(ms.memberEmail);
    if (!memberId) {
      missingMember++;
      continue;
    }
    const clubId = clubsBySlug.get(ms.clubSlug);
    if (!clubId) {
      missingClub++;
      continue;
    }

    const paidAt = new Date(ms.paidAt);
    const key = `${memberId}:${clubId}:${paidAt.toISOString()}`;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const expiresAt = new Date(paidAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + ms.termYears);

    toInsert.push({
      memberId,
      clubId,
      termYears: ms.termYears,
      amountPaid: String(ms.amountPaid),
      paidAt,
      expiresAt,
      academicYear: ms.academicYear,
      orderRef: ms.orderRef ?? null,
    });
  }

  // 5. Insert in batches of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    await db.insert(membershipsTable).values(toInsert.slice(i, i + BATCH_SIZE));
    inserted += Math.min(BATCH_SIZE, toInsert.length - i);
  }

  console.log("Done.");
  console.log(`  Clubs upserted:       ${upsertedClubs.length}`);
  console.log(`  Members upserted:     ${upsertedMembers.length}`);
  console.log(`  Memberships inserted: ${inserted}`);
  console.log(`  Memberships skipped:  ${skipped}`);
  if (missingMember > 0)
    console.log(`  Skipped (no member):  ${missingMember}`);
  if (missingClub > 0) console.log(`  Skipped (no club):    ${missingClub}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
