import { db, membersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import membersSeedData from "./members-seed.json";

interface MemberSeedRecord {
  fullName: string;
  email: string | null;
  linkedinUrl: string | null;
  program: "full_time" | "evening";
  classYear: number;
}

const MEMBERS = membersSeedData as MemberSeedRecord[];

const BATCH_SIZE = 100;

export async function ensureMembers(): Promise<void> {
  // Fetch all existing members once upfront.
  const existing = await db
    .select({ email: membersTable.email, linkedinUrl: membersTable.linkedinUrl })
    .from(membersTable);

  // Build a set of linkedin_urls already committed in DB (keyed by members
  // that are NOT in our seed-by-email set, so we avoid false conflicts).
  const seedEmailSet = new Set(MEMBERS.map((m) => m.email).filter(Boolean) as string[]);
  const takenLinkedins = new Set(
    existing
      .filter((r) => r.linkedinUrl && (!r.email || !seedEmailSet.has(r.email)))
      .map((r) => r.linkedinUrl as string),
  );

  const withEmail = MEMBERS.filter((m) => m.email != null).map((m) => ({
    ...m,
    // Null out linkedin_url if it's already claimed by a member outside our upsert set.
    linkedinUrl: m.linkedinUrl && takenLinkedins.has(m.linkedinUrl) ? null : m.linkedinUrl,
  }));

  const withLinkedinOnly = MEMBERS.filter(
    (m) => m.email == null && m.linkedinUrl != null,
  );
  const noKey = MEMBERS.filter((m) => m.email == null && m.linkedinUrl == null);

  // Upsert all members with an email — inserts new ones AND updates
  // linkedinUrl on existing ones so LinkedIn links stay current.
  for (let i = 0; i < withEmail.length; i += BATCH_SIZE) {
    await db
      .insert(membersTable)
      .values(withEmail.slice(i, i + BATCH_SIZE))
      .onConflictDoUpdate({
        target: membersTable.email,
        set: {
          fullName: sql`excluded.full_name`,
          program: sql`excluded.program`,
          classYear: sql`excluded.class_year`,
          linkedinUrl: sql`excluded.linkedin_url`,
          updatedAt: sql`now()`,
        },
      });
  }

  // Upsert members who only have a LinkedIn URL (no email).
  for (let i = 0; i < withLinkedinOnly.length; i += BATCH_SIZE) {
    await db
      .insert(membersTable)
      .values(withLinkedinOnly.slice(i, i + BATCH_SIZE))
      .onConflictDoUpdate({
        target: membersTable.linkedinUrl,
        set: {
          fullName: sql`excluded.full_name`,
          program: sql`excluded.program`,
          classYear: sql`excluded.class_year`,
          updatedAt: sql`now()`,
        },
      });
  }

  // Members with neither email nor LinkedIn — only insert once.
  if (noKey.length > 0) {
    const existingNames = new Set(
      existing.filter((r) => !r.email && !r.linkedinUrl).map(() => ""),
    );
    const toInsert = noKey.filter((m) => !existingNames.has(m.fullName));
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      await db.insert(membersTable).values(toInsert.slice(i, i + BATCH_SIZE));
    }
  }

  logger.info(
    { withEmail: withEmail.length, withLinkedinOnly: withLinkedinOnly.length, noKey: noKey.length },
    "ensureMembers: sync complete",
  );
}
