import { Router, type IRouter } from "express";
import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { z } from "zod/v4";
import { db, clubsTable, membersTable, membershipsTable } from "@workspace/db";
import type { Member } from "@workspace/db";

const router: IRouter = Router();

function shapeMember(m: Member) {
  return {
    id: m.id,
    fullName: m.fullName,
    email: m.email,
    program: m.program,
    classYear: m.classYear,
  };
}

router.get("/members/directory", async (req, res): Promise<void> => {
  const params = z
    .object({
      q: z.string().optional(),
      program: z.enum(["full_time", "evening"]).optional(),
      classYear: z.coerce.number().int().optional(),
    })
    .safeParse(req.query);

  if (!params.success) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const { q, program, classYear } = params.data;
  const conditions = [];

  if (q) {
    conditions.push(
      or(
        ilike(membersTable.fullName, `%${q}%`),
        ilike(membersTable.email, `%${q}%`),
      ),
    );
  }
  if (program) conditions.push(eq(membersTable.program, program));
  if (classYear) conditions.push(eq(membersTable.classYear, classYear));

  const rows = await db
    .select()
    .from(membersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(membersTable.fullName));

  res.json(rows.map(shapeMember));
});

router.get("/members/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }

  const results = await db
    .select()
    .from(membersTable)
    .where(
      or(
        ilike(membersTable.fullName, `%${q}%`),
        ilike(membersTable.email, `%${q}%`),
      ),
    )
    .orderBy(asc(membersTable.fullName))
    .limit(20);

  req.log.debug({ q, count: results.length }, "member search");
  res.json(results.map(shapeMember));
});

router.get("/members/:id/memberships", async (req, res): Promise<void> => {
  const params = z.object({ id: z.string().uuid() }).safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid member id" });
    return;
  }

  const [member] = await db
    .select()
    .from(membersTable)
    .where(eq(membersTable.id, params.data.id));

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  const now = new Date();
  const rows = await db
    .select({
      clubId: membershipsTable.clubId,
      clubName: clubsTable.name,
      clubSlug: clubsTable.slug,
      termYears: membershipsTable.termYears,
      amountPaid: membershipsTable.amountPaid,
      paidAt: membershipsTable.paidAt,
      expiresAt: membershipsTable.expiresAt,
      academicYear: membershipsTable.academicYear,
    })
    .from(membershipsTable)
    .innerJoin(clubsTable, eq(membershipsTable.clubId, clubsTable.id))
    .where(eq(membershipsTable.memberId, params.data.id))
    .orderBy(desc(membershipsTable.paidAt));

  res.json({
    member: shapeMember(member),
    memberships: rows.map((r) => ({
      clubId: r.clubId,
      clubName: r.clubName,
      clubSlug: r.clubSlug,
      termYears: r.termYears,
      amountPaid: parseFloat(r.amountPaid),
      paidAt: r.paidAt,
      expiresAt: r.expiresAt,
      isActive: r.expiresAt > now,
      academicYear: r.academicYear,
    })),
  });
});

export default router;
