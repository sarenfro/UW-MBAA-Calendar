import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";
import { db, membersTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Program = "full_time" | "evening";

interface SheetMeta {
  program: Program;
  classYear: number;
}

function parseSheetMeta(sheetName: string): SheetMeta | null {
  const yearMatch = sheetName.match(/\b(\d{4})\b/);
  if (!yearMatch) return null;
  const classYear = parseInt(yearMatch[1], 10);
  const program: Program = sheetName.startsWith("FT") ? "full_time" : "evening";
  return { program, classYear };
}

interface XlsxRow {
  "First Name"?: string;
  "Last Name"?: string;
  "Email"?: string;
  "LinkedIn"?: string;
  [key: string]: unknown;
}

interface MemberRecord {
  email: string | null;
  fullName: string;
  program: Program;
  classYear: number;
  linkedinUrl: string | null;
}

async function main(): Promise<void> {
  const filePath = join(
    __dirname,
    "../data/UW MBA Cohort Student Directory.xlsx",
  );

  const workbook = XLSX.readFile(filePath);
  const withEmail: MemberRecord[] = [];
  const withoutEmail: MemberRecord[] = [];
  const noKey: MemberRecord[] = [];

  for (const sheetName of workbook.SheetNames) {
    const meta = parseSheetMeta(sheetName);
    if (!meta) {
      console.log(`  Skipping (unparseable sheet name): ${sheetName}`);
      continue;
    }

    const ws = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<XlsxRow>(ws);
    let parsed = 0;

    for (const row of rows) {
      const firstName = (row["First Name"] as string | undefined)?.trim() ?? "";
      const lastName = (row["Last Name"] as string | undefined)?.trim() ?? "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ");
      if (!fullName) continue;

      const rawEmail = (row["Email"] as string | undefined)?.trim() ?? "";
      const email = rawEmail && rawEmail.toLowerCase() !== "n/a" ? rawEmail : null;

      const rawLinkedin = (row["LinkedIn"] as string | undefined)?.trim() ?? "";
      const linkedinUrl =
        rawLinkedin && rawLinkedin.toLowerCase() !== "n/a" && rawLinkedin.startsWith("http")
          ? rawLinkedin
          : null;

      const record: MemberRecord = {
        email,
        fullName,
        program: meta.program,
        classYear: meta.classYear,
        linkedinUrl,
      };

      if (email) {
        withEmail.push(record);
      } else if (linkedinUrl) {
        withoutEmail.push(record);
      } else {
        noKey.push(record);
      }
      parsed++;
    }

    console.log(`  Parsed "${sheetName}": ${parsed} members`);
  }

  const emailDeduped = new Map(withEmail.map((m) => [m.email!.toLowerCase(), m]));
  const linkedinDeduped = new Map(withoutEmail.map((m) => [m.linkedinUrl!, m]));

  const emailBatch = [...emailDeduped.values()];
  const linkedinBatch = [...linkedinDeduped.values()];

  console.log(
    `\nUpserting ${emailBatch.length} by email, ${linkedinBatch.length} by LinkedIn URL` +
      (noKey.length > 0 ? `, inserting ${noKey.length} with no unique key` : "") +
      "...",
  );

  const BATCH_SIZE = 100;

  for (let i = 0; i < emailBatch.length; i += BATCH_SIZE) {
    await db
      .insert(membersTable)
      .values(emailBatch.slice(i, i + BATCH_SIZE))
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

  for (let i = 0; i < linkedinBatch.length; i += BATCH_SIZE) {
    await db
      .insert(membersTable)
      .values(linkedinBatch.slice(i, i + BATCH_SIZE))
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

  for (let i = 0; i < noKey.length; i += BATCH_SIZE) {
    await db.insert(membersTable).values(noKey.slice(i, i + BATCH_SIZE));
  }

  const total = emailBatch.length + linkedinBatch.length + noKey.length;
  console.log("\nDone.");
  console.log(`  Upserted with email:    ${emailBatch.length}`);
  console.log(`  Upserted via LinkedIn:  ${linkedinBatch.length}`);
  if (noKey.length > 0)
    console.log(`  Inserted (no key):      ${noKey.length}`);
  console.log(`  Total:                  ${total}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
