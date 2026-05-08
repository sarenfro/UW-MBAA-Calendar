import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { db, calendarsTable, eventsTable } from "@workspace/db";
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

export default router;
