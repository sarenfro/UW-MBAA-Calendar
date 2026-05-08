import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, calendarsTable, eventsTable, clubsTable } from "@workspace/db";
import { syncAllCalendars } from "../lib/sync-calendars";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as Record<string, unknown>;
  const password = (body?.password ?? (req.query as Record<string, unknown>)?.password) as string | undefined;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) { next(); return; }
  if (password === adminPassword) { next(); return; }
  res.status(401).json({ error: "Unauthorized" });
}

// ---------------------------------------------------------------------------
// POST /api/admin/verify
// ---------------------------------------------------------------------------
router.post("/admin/verify", (req, res): void => {
  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Password is required" });
    return;
  }
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    req.log.warn("ADMIN_PASSWORD not set — admin access is unrestricted");
    res.json({ ok: true });
    return;
  }
  if (body.data.password === adminPassword) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: "Incorrect password" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/sync-calendars
// ---------------------------------------------------------------------------
router.post("/admin/sync-calendars", requireAdmin, async (req, res): Promise<void> => {
  req.log.info("admin: sync-calendars started");
  try {
    const results = await syncAllCalendars();
    const totalEvents = results.reduce((sum, r) => sum + r.events, 0);
    const skipped = results.filter((r) => r.skipped);
    req.log.info({ totalEvents, skipped: skipped.length }, "admin: sync-calendars complete");
    res.json({ ok: true, totalEvents, results });
  } catch (err) {
    req.log.error({ err }, "admin: sync-calendars failed");
    res.status(500).json({ error: "Sync failed" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/calendars — list all calendars including subscriptionUrl
// ---------------------------------------------------------------------------
router.get("/admin/calendars", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select().from(calendarsTable).orderBy(calendarsTable.id);
  res.json(rows);
});

const calendarBodySchema = z.object({
  password: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().min(1),
  timezone: z.string().optional(),
  owner: z.string().min(1),
  subscriptionUrl: z.string().optional(),
  defaultHidden: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/admin/calendars — create a calendar
// ---------------------------------------------------------------------------
router.post("/admin/calendars", requireAdmin, async (req, res): Promise<void> => {
  const parsed = calendarBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { password: _pw, ...fields } = parsed.data;
  const [row] = await db
    .insert(calendarsTable)
    .values({
      name: fields.name,
      description: fields.description ?? null,
      color: fields.color,
      timezone: fields.timezone ?? "UTC",
      owner: fields.owner,
      subscriptionUrl: fields.subscriptionUrl ?? null,
      defaultHidden: fields.defaultHidden ?? false,
    })
    .returning();
  req.log.info({ id: row.id, name: row.name }, "admin: calendar created");
  res.status(201).json(row);
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/calendars/:id — update a calendar
// ---------------------------------------------------------------------------
router.patch("/admin/calendars/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = calendarBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { password: _pw, ...fields } = parsed.data;
  const existing = await db.select().from(calendarsTable).where(eq(calendarsTable.id, id));
  if (!existing.length) {
    res.status(404).json({ error: "Calendar not found" });
    return;
  }
  const [row] = await db
    .update(calendarsTable)
    .set({
      ...(fields.name !== undefined && { name: fields.name }),
      ...(fields.description !== undefined && { description: fields.description }),
      ...(fields.color !== undefined && { color: fields.color }),
      ...(fields.timezone !== undefined && { timezone: fields.timezone }),
      ...(fields.owner !== undefined && { owner: fields.owner }),
      ...(fields.subscriptionUrl !== undefined && { subscriptionUrl: fields.subscriptionUrl }),
      ...(fields.defaultHidden !== undefined && { defaultHidden: fields.defaultHidden }),
    })
    .where(eq(calendarsTable.id, id))
    .returning();
  req.log.info({ id: row.id, name: row.name }, "admin: calendar updated");
  res.json(row);
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/calendars/:id — delete a calendar and its events
// ---------------------------------------------------------------------------
router.delete("/admin/calendars/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const existing = await db.select().from(calendarsTable).where(eq(calendarsTable.id, id));
  if (!existing.length) {
    res.status(404).json({ error: "Calendar not found" });
    return;
  }
  await db.delete(eventsTable).where(eq(eventsTable.calendarId, id));
  await db.delete(calendarsTable).where(eq(calendarsTable.id, id));
  req.log.info({ id }, "admin: calendar deleted");
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// GET /api/admin/clubs — list all clubs
// ---------------------------------------------------------------------------
router.get("/admin/clubs", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select().from(clubsTable).orderBy(clubsTable.name);
  res.json(
    rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      calendarId: c.calendarId,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
    })),
  );
});

const clubBodySchema = z.object({
  password: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string().optional(),
  calendarId: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// POST /api/admin/clubs — create a club
// ---------------------------------------------------------------------------
router.post("/admin/clubs", requireAdmin, async (req, res): Promise<void> => {
  const parsed = clubBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }
  const { password: _pw, ...fields } = parsed.data;
  const [existing] = await db.select({ id: clubsTable.id }).from(clubsTable)
    .where(eq(clubsTable.slug, fields.slug));
  if (existing) {
    res.status(409).json({ error: "A club with that slug already exists" });
    return;
  }
  const [row] = await db.insert(clubsTable).values({
    name: fields.name,
    slug: fields.slug,
    description: fields.description ?? null,
    calendarId: fields.calendarId ?? null,
    isActive: fields.isActive ?? true,
  }).returning();
  req.log.info({ id: row.id, name: row.name }, "admin: club created");
  res.status(201).json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    calendarId: row.calendarId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/clubs/:id — update a club
// ---------------------------------------------------------------------------
router.patch("/admin/clubs/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const parsed = clubBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const { password: _pw, ...fields } = parsed.data;
  const [existing] = await db.select().from(clubsTable).where(eq(clubsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Club not found" });
    return;
  }
  const [row] = await db.update(clubsTable).set({
    ...(fields.name !== undefined && { name: fields.name }),
    ...(fields.slug !== undefined && { slug: fields.slug }),
    ...(fields.description !== undefined && { description: fields.description }),
    ...(fields.calendarId !== undefined && { calendarId: fields.calendarId }),
    ...(fields.isActive !== undefined && { isActive: fields.isActive }),
    updatedAt: new Date(),
  }).where(eq(clubsTable.id, id)).returning();
  req.log.info({ id: row.id, name: row.name }, "admin: club updated");
  res.json({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    calendarId: row.calendarId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/clubs/:id — delete a club and all its memberships/leads
// ---------------------------------------------------------------------------
router.delete("/admin/clubs/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const [existing] = await db.select({ id: clubsTable.id }).from(clubsTable).where(eq(clubsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Club not found" });
    return;
  }
  // Cascade deletes handle memberships, club_leads, and lead_access_tokens automatically
  await db.delete(clubsTable).where(eq(clubsTable.id, id));
  req.log.info({ id }, "admin: club deleted");
  res.status(204).send();
});

export default router;
