import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  ne,
  sql,
} from "drizzle-orm";
import { z } from "zod/v4";
import { Resend } from "resend";
import {
  db,
  clubsTable,
  clubLeadsTable,
  leadAccessTokensTable,
  membersTable,
  membershipsTable,
} from "@workspace/db";
import type { Club } from "@workspace/db";
import {
  academicYearFor,
  priorAcademicYear,
  academicYearEnd,
} from "../lib/academic-year";

const router: IRouter = Router();

// 3.5% PayPal fee rate from the original Excel workbook. Confirmed by user.
const PAYPAL_FEE_RATE = 0.035;

function shapeClub(c: Club) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    calendarId: c.calendarId,
    pricing: c.pricing,
    isActive: c.isActive,
  };
}

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// Validates a magic-link token. For the CSV endpoint, pass allowUsed=true so
// users can download after viewing the roster with the same token.
async function validateToken(
  token: string,
  slug: string,
  allowUsed = false,
): Promise<
  | { valid: true; clubId: string }
  | { valid: false; code: string; message: string }
> {
  if (!token) {
    return { valid: false, code: "token_invalid", message: "No token provided" };
  }

  const [tokenRow] = await db
    .select()
    .from(leadAccessTokensTable)
    .where(eq(leadAccessTokensTable.token, token));

  if (!tokenRow) {
    return { valid: false, code: "token_invalid", message: "Token not found" };
  }
  if (tokenRow.expiresAt < new Date()) {
    return { valid: false, code: "token_expired", message: "Token has expired" };
  }
  if (!allowUsed && tokenRow.usedAt) {
    return { valid: false, code: "token_used", message: "Token has already been used" };
  }

  // Confirm the token belongs to a lead for this specific club
  const [lead] = await db
    .select({ clubId: clubLeadsTable.clubId })
    .from(clubLeadsTable)
    .innerJoin(clubsTable, eq(clubLeadsTable.clubId, clubsTable.id))
    .where(
      and(
        eq(clubLeadsTable.id, tokenRow.clubLeadId),
        eq(clubsTable.slug, slug),
      ),
    );

  if (!lead) {
    return {
      valid: false,
      code: "token_invalid",
      message: "Token does not match this club",
    };
  }

  return { valid: true, clubId: lead.clubId };
}

// ---------------------------------------------------------------------------
// GET /api/clubs
// ---------------------------------------------------------------------------
router.get("/clubs", async (req, res): Promise<void> => {
  const clubs = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.isActive, true))
    .orderBy(asc(clubsTable.name));

  res.json(clubs.map(shapeClub));
});

// ---------------------------------------------------------------------------
// GET /api/clubs/:slug/summary
// ---------------------------------------------------------------------------
router.get("/clubs/:slug/summary", async (req, res): Promise<void> => {
  const { slug } = req.params;

  const [club] = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.slug, slug));

  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  const now = new Date();
  const currentYear = academicYearFor(now);
  const prior = priorAcademicYear(currentYear);

  // Current-year members with their program
  const currentYearRows = await db
    .select({
      memberId: membershipsTable.memberId,
      program: membersTable.program,
    })
    .from(membershipsTable)
    .innerJoin(membersTable, eq(membershipsTable.memberId, membersTable.id))
    .where(
      and(
        eq(membershipsTable.clubId, club.id),
        eq(membershipsTable.academicYear, currentYear),
      ),
    );

  // Deduplicate: one entry per member (they may have multiple membership rows)
  const programByMemberId = new Map<string, string>();
  for (const row of currentYearRows) {
    if (!programByMemberId.has(row.memberId)) {
      programByMemberId.set(row.memberId, row.program);
    }
  }
  const currentYearMemberIds = [...programByMemberId.keys()];

  // Which current-year members also purchased in a prior year (returning)
  const returningIds = new Set<string>();
  if (currentYearMemberIds.length > 0) {
    const returningRows = await db
      .selectDistinct({ memberId: membershipsTable.memberId })
      .from(membershipsTable)
      .where(
        and(
          eq(membershipsTable.clubId, club.id),
          ne(membershipsTable.academicYear, currentYear),
          inArray(membershipsTable.memberId, currentYearMemberIds),
        ),
      );
    for (const r of returningRows) returningIds.add(r.memberId);
  }

  let ftNew = 0, ftReturning = 0, evNew = 0, evReturning = 0;
  for (const [memberId, program] of programByMemberId) {
    const isReturning = returningIds.has(memberId);
    if (program === "full_time") {
      isReturning ? ftReturning++ : ftNew++;
    } else {
      isReturning ? evReturning++ : evNew++;
    }
  }

  // Amount paid in current academic year
  const [amountRow] = await db
    .select({
      total: sql<string>`coalesce(sum(${membershipsTable.amountPaid}), '0')`,
    })
    .from(membershipsTable)
    .where(
      and(
        eq(membershipsTable.clubId, club.id),
        eq(membershipsTable.academicYear, currentYear),
      ),
    );

  const amountPaid = parseFloat(amountRow?.total ?? "0");
  const paypalFee = parseFloat((amountPaid * PAYPAL_FEE_RATE).toFixed(2));
  const netDues = parseFloat((amountPaid - paypalFee).toFixed(2));

  // Year-over-year member counts (all academic years)
  const yoyRows = await db
    .select({
      academicYear: membershipsTable.academicYear,
      memberCount: sql<number>`cast(count(distinct ${membershipsTable.memberId}) as int)`,
    })
    .from(membershipsTable)
    .where(eq(membershipsTable.clubId, club.id))
    .groupBy(membershipsTable.academicYear)
    .orderBy(asc(membershipsTable.academicYear));

  res.json({
    club: shapeClub(club),
    currentAcademicYear: currentYear,
    priorAcademicYear: prior,
    fullTime: {
      newThisYear: ftNew,
      returning: ftReturning,
      total: ftNew + ftReturning,
    },
    evening: {
      newThisYear: evNew,
      returning: evReturning,
      total: evNew + evReturning,
    },
    totalMembers: currentYearMemberIds.length,
    amountPaid,
    paypalFee,
    netDues,
    yearOverYear: yoyRows,
  });
});

// ---------------------------------------------------------------------------
// POST /api/clubs/:slug/request-access
// If RESEND_API_KEY is not set, the magic link is returned in the response
// body under the key "magicLink" (dev fallback). In production, only the
// generic success message is returned and the link is emailed.
// ---------------------------------------------------------------------------
router.post("/clubs/:slug/request-access", async (req, res): Promise<void> => {
  const { slug } = req.params;

  const body = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  const [club] = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.slug, slug));

  if (!club) {
    res.status(404).json({ error: "Club not found" });
    return;
  }

  const GENERIC_OK = {
    message:
      "If your email is registered as a lead for that club, you will receive a link in your inbox shortly.",
  };

  // Look up the club lead without revealing whether the email is registered
  const [leadRow] = await db
    .select({ leadId: clubLeadsTable.id })
    .from(clubLeadsTable)
    .innerJoin(membersTable, eq(clubLeadsTable.memberId, membersTable.id))
    .where(
      and(
        eq(clubLeadsTable.clubId, club.id),
        eq(membersTable.email, body.data.email),
      ),
    );

  if (!leadRow) {
    res.json(GENERIC_OK);
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(leadAccessTokensTable).values({
    clubLeadId: leadRow.leadId,
    token,
    expiresAt,
  });

  const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:80";
  const magicLink = `${APP_BASE_URL}/membership/lead?token=${token}&club=${slug}`;

  if (!process.env.RESEND_API_KEY) {
    req.log.warn(
      { magicLink },
      "RESEND_API_KEY not set: returning magic link in response (dev fallback)",
    );
    res.json({ ...GENERIC_OK, magicLink });
    return;
  }

  // Set RESEND_FROM to your verified sender address (e.g. "MBAA <no-reply@yourdomain.com>")
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from,
    to: body.data.email,
    subject: `Your ${club.name} roster access link`,
    text: [
      `You requested access to the ${club.name} member roster.`,
      ``,
      `Use the link below to view the roster. This link expires in 24 hours and can only be used once.`,
      ``,
      magicLink,
      ``,
      `If you did not request this, you can ignore this email.`,
    ].join("\n"),
  });

  req.log.info({ clubSlug: slug }, "roster access link sent");
  res.json(GENERIC_OK);
});

// ---------------------------------------------------------------------------
// GET /api/clubs/:slug/roster?token=
// Token is validated and marked used on this endpoint.
// ---------------------------------------------------------------------------
router.get("/clubs/:slug/roster", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const token = typeof req.query.token === "string" ? req.query.token : "";

  const validation = await validateToken(token, slug, false);
  if (!validation.valid) {
    res.status(403).json({ error: validation.message, code: validation.code });
    return;
  }

  // Mark token used
  await db
    .update(leadAccessTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(leadAccessTokensTable.token, token));

  const { clubId } = validation;
  const [club] = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.id, clubId));

  const now = new Date();
  const currentYear = academicYearFor(now);
  const prior = priorAcademicYear(currentYear);
  const yearEnd = academicYearEnd(currentYear);

  // All members who ever purchased for this club
  const allMembershipRows = await db
    .select()
    .from(membershipsTable)
    .where(eq(membershipsTable.clubId, clubId))
    .orderBy(desc(membershipsTable.paidAt));

  const allMemberIds = [...new Set(allMembershipRows.map((r) => r.memberId))];

  if (allMemberIds.length === 0) {
    res.json({
      club: shapeClub(club),
      currentAcademicYear: currentYear,
      members: [],
      renewalForecast: { expiringThisYear: [], lapsedLastYear: [] },
    });
    return;
  }

  const memberRows = await db
    .select()
    .from(membersTable)
    .where(inArray(membersTable.id, allMemberIds))
    .orderBy(asc(membersTable.fullName));

  const memberMap = new Map(memberRows.map((m) => [m.id, m]));

  // Group memberships by member
  const msByMember = new Map<string, typeof allMembershipRows>();
  for (const ms of allMembershipRows) {
    if (!msByMember.has(ms.memberId)) msByMember.set(ms.memberId, []);
    msByMember.get(ms.memberId)!.push(ms);
  }

  const members = memberRows.map((m) => ({
    fullName: m.fullName,
    email: m.email,
    program: m.program,
    classYear: m.classYear,
    memberships: (msByMember.get(m.id) ?? []).map((ms) => ({
      termYears: ms.termYears,
      amountPaid: parseFloat(ms.amountPaid),
      paidAt: ms.paidAt,
      expiresAt: ms.expiresAt,
      isActive: ms.expiresAt > now,
      academicYear: ms.academicYear,
    })),
  }));

  // Renewal forecast
  const currentYearMemberIds = new Set<string>();
  const priorYearMemberIds = new Set<string>();
  const latestExpiryByMember = new Map<string, Date>();

  for (const ms of allMembershipRows) {
    if (ms.academicYear === currentYear) currentYearMemberIds.add(ms.memberId);
    if (ms.academicYear === prior) priorYearMemberIds.add(ms.memberId);
    const prev = latestExpiryByMember.get(ms.memberId);
    if (!prev || ms.expiresAt > prev) latestExpiryByMember.set(ms.memberId, ms.expiresAt);
  }

  const expiringThisYear: { fullName: string; email: string; expiresAt: Date }[] = [];
  for (const [memberId, expiresAt] of latestExpiryByMember) {
    if (expiresAt > now && expiresAt < yearEnd) {
      const m = memberMap.get(memberId);
      if (m) expiringThisYear.push({ fullName: m.fullName, email: m.email, expiresAt });
    }
  }

  const lapsedLastYear: { fullName: string; email: string; lastPaidAcademicYear: string }[] = [];
  for (const memberId of priorYearMemberIds) {
    if (!currentYearMemberIds.has(memberId)) {
      const m = memberMap.get(memberId);
      if (m) lapsedLastYear.push({ fullName: m.fullName, email: m.email, lastPaidAcademicYear: prior });
    }
  }

  res.json({
    club: shapeClub(club),
    currentAcademicYear: currentYear,
    members,
    renewalForecast: { expiringThisYear, lapsedLastYear },
  });
});

// ---------------------------------------------------------------------------
// GET /api/clubs/:slug/roster.csv?token=
// Same gating as the roster endpoint but allows already-used tokens so users
// can download the CSV after viewing the roster in the same session.
// ---------------------------------------------------------------------------
router.get("/clubs/:slug/roster.csv", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const token = typeof req.query.token === "string" ? req.query.token : "";

  const validation = await validateToken(token, slug, true);
  if (!validation.valid) {
    res.status(403).json({ error: validation.message, code: validation.code });
    return;
  }

  const { clubId } = validation;
  const [club] = await db
    .select()
    .from(clubsTable)
    .where(eq(clubsTable.id, clubId));

  const now = new Date();
  const currentYear = academicYearFor(now);

  const allMembershipRows = await db
    .select()
    .from(membershipsTable)
    .where(eq(membershipsTable.clubId, clubId))
    .orderBy(asc(membershipsTable.memberId), desc(membershipsTable.paidAt));

  const allMemberIds = [...new Set(allMembershipRows.map((r) => r.memberId))];

  const memberRows =
    allMemberIds.length > 0
      ? await db
          .select()
          .from(membersTable)
          .where(inArray(membersTable.id, allMemberIds))
          .orderBy(asc(membersTable.fullName))
      : [];

  const memberMap = new Map(memberRows.map((m) => [m.id, m]));

  const csvHeader = [
    "Name",
    "Email",
    "Program",
    "Class Year",
    "Term",
    "Amount Paid",
    "Purchase Date",
    "Expires",
    "Active",
    "Academic Year",
  ].join(",");

  const csvLines: string[] = [csvHeader];

  // One row per membership record, sorted by member name then purchase date desc
  const sortedRows = [...allMembershipRows].sort((a, b) => {
    const ma = memberMap.get(a.memberId);
    const mb = memberMap.get(b.memberId);
    const nameCompare = (ma?.fullName ?? "").localeCompare(mb?.fullName ?? "");
    if (nameCompare !== 0) return nameCompare;
    return b.paidAt.getTime() - a.paidAt.getTime();
  });

  for (const ms of sortedRows) {
    const m = memberMap.get(ms.memberId);
    if (!m) continue;
    csvLines.push(
      [
        csvEscape(m.fullName),
        csvEscape(m.email),
        m.program === "full_time" ? "Full-Time" : "Evening",
        String(m.classYear),
        String(ms.termYears),
        parseFloat(ms.amountPaid).toFixed(2),
        ms.paidAt.toISOString().split("T")[0],
        ms.expiresAt.toISOString().split("T")[0],
        ms.expiresAt > now ? "Yes" : "No",
        ms.academicYear,
      ].join(","),
    );
  }

  const filename = `${slug}-roster-${currentYear}.csv`;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvLines.join("\n"));
});

export default router;
