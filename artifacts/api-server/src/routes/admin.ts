import { Router, type IRouter } from "express";
import { z } from "zod/v4";

const router: IRouter = Router();

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

export default router;
