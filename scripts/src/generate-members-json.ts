import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface MemberRecord {
  fullName: string;
  email: string | null;
  linkedinUrl: string | null;
  program: "full_time" | "evening";
  classYear: number;
}

const filePath = join(__dirname, "../data/UW MBA Cohort Student Directory.xlsx");
const wb = XLSX.readFile(filePath);
const members: MemberRecord[] = [];

for (const sheetName of wb.SheetNames) {
  const yearMatch = sheetName.match(/\b(\d{4})\b/);
  if (!yearMatch) { console.log(`Skipping: ${sheetName}`); continue; }
  const classYear = parseInt(yearMatch[1], 10);
  const program: "full_time" | "evening" = sheetName.startsWith("FT") ? "full_time" : "evening";
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]);
  let count = 0;
  for (const row of rows) {
    const firstName = ((row["First Name"] as string | undefined) ?? "").trim();
    const lastName = ((row["Last Name"] as string | undefined) ?? "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    if (!fullName) continue;
    const rawEmail = ((row["Email"] as string | undefined) ?? "").trim();
    const email = rawEmail && rawEmail.toLowerCase() !== "n/a" ? rawEmail : null;
    const rawLinkedin = ((row["LinkedIn"] as string | undefined) ?? "").trim();
    const linkedinUrl =
      rawLinkedin && rawLinkedin.toLowerCase() !== "n/a" && rawLinkedin.startsWith("http")
        ? rawLinkedin
        : null;
    members.push({ fullName, email, linkedinUrl, program, classYear });
    count++;
  }
  console.log(`  ${sheetName}: ${count} members`);
}

// Deduplicate: email wins; then linkedin_url; then name+program+year
const seenEmails = new Set<string>();
const seenLinkedins = new Set<string>();
const deduped: MemberRecord[] = [];
for (const m of members) {
  if (m.email) {
    if (seenEmails.has(m.email)) continue;
    seenEmails.add(m.email);
  }
  if (m.linkedinUrl) {
    if (seenLinkedins.has(m.linkedinUrl)) { m.linkedinUrl = null; }
    else { seenLinkedins.add(m.linkedinUrl); }
  }
  deduped.push(m);
}

const outPath = join(__dirname, "../../artifacts/api-server/src/lib/members-seed.json");
writeFileSync(outPath, JSON.stringify(deduped, null, 2));
console.log(`\nWrote ${deduped.length} members to members-seed.json (deduplicated from ${members.length})`);
