import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import multer from "multer";
import path from "node:path";
import { db, studentLeadersTable } from "@workspace/db";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const body = req.body as Record<string, unknown>;
  const password =
    (body?.password as string | undefined) ??
    ((req.query as Record<string, unknown>)?.password as string | undefined);
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) { next(); return; }
  if (password === adminPassword) { next(); return; }
  res.status(401).json({ error: "Unauthorized" });
}

const PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (PHOTO_EXTENSIONS.has(ext)) { cb(null, true); }
    else { cb(new Error(`Photo type not allowed: ${ext}`)); }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureCurrentEntry() {
  return db
    .select()
    .from(studentLeadersTable)
    .where(eq(studentLeadersTable.isCurrent, true))
    .limit(1);
}

// ─── Public ───────────────────────────────────────────────────────────────────

// GET /api/student-leader/current
router.get("/student-leader/current", async (_req, res): Promise<void> => {
  const [row] = await ensureCurrentEntry();
  if (!row) { res.status(404).json({ error: "No current entry" }); return; }
  res.json(row);
});

// GET /api/student-leader/history
router.get("/student-leader/history", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(studentLeadersTable)
    .where(eq(studentLeadersTable.isCurrent, false))
    .orderBy(desc(studentLeadersTable.createdAt));
  res.json(rows.filter((r) => r.winnerName));
});

// ─── Admin ────────────────────────────────────────────────────────────────────

const updateBodySchema = z.object({
  password: z.string(),
  quarter: z.string().optional(),
  status: z.enum(["nominations_open", "nominations_closed", "announced"]).optional(),
  winnerName: z.string().optional(),
  winnerClub: z.string().optional(),
  winnerProgram: z.string().optional(),
  winnerBio: z.string().optional(),
  winnerPhotoUrl: z.string().optional(),
  nominatedBy: z.string().optional(),
  reason: z.string().optional(),
});

// PATCH /api/admin/student-leader/:id
router.patch("/admin/student-leader/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = updateBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid body" }); return; }
  const { password: _pw, ...fields } = parsed.data;

  const updates: Partial<typeof studentLeadersTable.$inferInsert> = {};
  if (fields.quarter !== undefined) updates.quarter = fields.quarter;
  if (fields.status !== undefined) updates.status = fields.status;
  if (fields.winnerName !== undefined) updates.winnerName = fields.winnerName || null;
  if (fields.winnerClub !== undefined) updates.winnerClub = fields.winnerClub || null;
  if (fields.winnerProgram !== undefined) updates.winnerProgram = fields.winnerProgram || null;
  if (fields.winnerBio !== undefined) updates.winnerBio = fields.winnerBio || null;
  if (fields.winnerPhotoUrl !== undefined) updates.winnerPhotoUrl = fields.winnerPhotoUrl || null;
  if (fields.nominatedBy !== undefined) updates.nominatedBy = fields.nominatedBy || null;
  if (fields.reason !== undefined) updates.reason = fields.reason || null;

  const [row] = await db
    .update(studentLeadersTable)
    .set(updates)
    .where(eq(studentLeadersTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Entry not found" }); return; }
  res.json(row);
});

// POST /api/admin/student-leader/:id/photo
router.post(
  "/admin/student-leader/:id/photo",
  requireAdmin,
  photoUpload.single("photo"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    if (!req.file) { res.status(400).json({ error: "No photo provided" }); return; }

    const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");
    const mime = req.file.mimetype || `image/${ext}`;
    const b64 = req.file.buffer.toString("base64");
    const photoUrl = `data:${mime};base64,${b64}`;

    const [row] = await db
      .update(studentLeadersTable)
      .set({ winnerPhotoUrl: photoUrl })
      .where(eq(studentLeadersTable.id, id))
      .returning();
    if (!row) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json({ photoUrl: row.winnerPhotoUrl });
  },
);

// POST /api/admin/student-leader/advance
const advanceBodySchema = z.object({
  password: z.string(),
  nextQuarter: z.string().min(1),
});

router.post("/admin/student-leader/advance", requireAdmin, async (req, res): Promise<void> => {
  const parsed = advanceBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "nextQuarter is required" }); return; }

  // Archive all current entries
  await db
    .update(studentLeadersTable)
    .set({ isCurrent: false })
    .where(eq(studentLeadersTable.isCurrent, true));

  // Create new quarter
  const [newRow] = await db
    .insert(studentLeadersTable)
    .values({ quarter: parsed.data.nextQuarter, status: "nominations_open", isCurrent: true })
    .returning();

  res.status(201).json(newRow);
});

export default router;
