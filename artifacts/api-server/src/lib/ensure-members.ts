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
  const existing = await db
    .select({ email: membersTable.email, linkedinUrl: membersTable.linkedinUrl })
    .from(membersTable);

  const existingEmails = new Set(existing.map((r) => r.email).filter(Boolean) as string[]);
  const existingLinkedins = new Set(
    existing.map((r) => r.linkedinUrl).filter(Boolean) as string[],
  );

  const withEmail = MEMBERS.filter(
    (m) => m.email && !existingEmails.has(m.email),
  );
  const withLinkedin = MEMBERS.filter(
    (m) => !m.email && m.linkedinUrl && !existingLinkedins.has(m.linkedinUrl),
  );
  const noKey = MEMBERS.filter((m) => !m.email && !m.linkedinUrl);

  const totalNew = withEmail.length + withLinkedin.length + noKey.length;

  if (totalNew === 0) {
    logger.info({ total: existing.length }, "ensureMembers: all members present");
    return;
  }

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

  for (let i = 0; i < withLinkedin.length; i += BATCH_SIZE) {
    await db
      .insert(membersTable)
      .values(withLinkedin.slice(i, i + BATCH_SIZE))
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

  if (noKey.length > 0) {
    for (let i = 0; i < noKey.length; i += BATCH_SIZE) {
      await db.insert(membersTable).values(noKey.slice(i, i + BATCH_SIZE));
    }
  }

  logger.info(
    { byEmail: withEmail.length, byLinkedin: withLinkedin.length, noKey: noKey.length },
    `ensureMembers: inserted ${totalNew} missing member(s)`,
  );
}
