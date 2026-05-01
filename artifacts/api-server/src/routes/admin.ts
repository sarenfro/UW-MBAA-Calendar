import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { syncAllCalendars } from "../lib/sync-calendars";

const router: IRouter = Router();

function requireAdmin(req: Parameters<Parameters<typeof router.use>[0]>[0], res: Parameters<Parameters<typeof router.use>[0]>[1], next: Parameters<Parameters<typeof router.use>[0]>[2]): void {
  const password = (req.body as Record<string, unknown>)?.password as string | undefined;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) { next(); return; }
  if (password === adminPassword) { next(); return; }
  res.status(401).json({ error: "Unauthorized" });
}

// ---------------------------------------------------------------------------
// POST /api/admin/verify
// Checks the submitted password against ADMIN_PASSWORD env var.
// If ADMIN_PASSWORD is not set, always returns ok (dev convenience).
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
// Fetches all calendar ICS feeds and refreshes events in the database.
// Requires ADMIN_PASSWORD in the request body.
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

export default router;
