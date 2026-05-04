import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { eq, isNull, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { Resend } from "resend";
import multer from "multer";
import {
  db,
  docExecTokensTable,
  docFoldersTable,
  docFilesTable,
} from "@workspace/db";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Allowed file extensions
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = new Set([
  // images
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".tiff", ".tif",
  ".bmp", ".ico", ".heic", ".heif", ".avif",
  // office documents
  ".pdf",
  ".doc", ".docx",
  ".xls", ".xlsx",
  ".ppt", ".pptx",
  ".odt", ".ods", ".odp",
  // text / markup
  ".md", ".markdown", ".txt", ".rtf", ".csv",
  // archives
  ".zip", ".rar", ".7z", ".tar", ".gz",
  // data / config
  ".json", ".xml", ".yaml", ".yml",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${ext || "(no extension)"}`));
    }
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getExecEmails(): Set<string> {
  return new Set(
    (process.env.EXEC_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

type ExecRequest = Request & { execEmail: string };

async function requireExec(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers["x-exec-token"];
  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "Exec token required" });
    return;
  }

  const [row] = await db
    .select()
    .from(docExecTokensTable)
    .where(eq(docExecTokensTable.token, token));

  if (!row || row.expiresAt < new Date()) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as ExecRequest).execEmail = row.email;
  next();
}

async function resolveExecToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [row] = await db
    .select()
    .from(docExecTokensTable)
    .where(eq(docExecTokensTable.token, token));
  return !!row && row.expiresAt > new Date();
}

// Columns returned in file listings (no content blob)
const FILE_META_COLS = {
  id: docFilesTable.id,
  folderId: docFilesTable.folderId,
  name: docFilesTable.name,
  size: docFilesTable.size,
  mimeType: docFilesTable.mimeType,
  uploadedBy: docFilesTable.uploadedBy,
  lastModifiedBy: docFilesTable.lastModifiedBy,
  lastModifiedAt: docFilesTable.lastModifiedAt,
  createdAt: docFilesTable.createdAt,
};

// ---------------------------------------------------------------------------
// POST /api/documents/auth/request
// ---------------------------------------------------------------------------
router.post("/documents/auth/request", async (req, res): Promise<void> => {
  const body = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "A valid email address is required" });
    return;
  }

  const email = body.data.email.toLowerCase();
  const GENERIC_OK = {
    message:
      "If your email has exec access, you will receive an access link shortly.",
  };

  if (!getExecEmails().has(email)) {
    res.json(GENERIC_OK);
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(docExecTokensTable).values({ email, token, expiresAt });

  const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:80";
  const magicLink = `${APP_BASE_URL}/documents?execToken=${token}`;

  if (!process.env.RESEND_API_KEY) {
    req.log.warn(
      { magicLink },
      "RESEND_API_KEY not set: returning magic link in response (dev fallback)",
    );
    res.json({ ...GENERIC_OK, magicLink });
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";

  await resend.emails.send({
    from,
    to: email,
    subject: "Your MBAA Document Library access link",
    text: [
      "You requested executive access to the MBAA Document Library.",
      "",
      "Click the link below to access. This link expires in 24 hours.",
      "",
      magicLink,
      "",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
  });

  req.log.info({ email }, "doc library exec access link sent");
  res.json(GENERIC_OK);
});

// ---------------------------------------------------------------------------
// POST /api/documents/auth/verify
// ---------------------------------------------------------------------------
router.post("/documents/auth/verify", async (req, res): Promise<void> => {
  const body = z.object({ token: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const [row] = await db
    .select()
    .from(docExecTokensTable)
    .where(eq(docExecTokensTable.token, body.data.token));

  if (!row || row.expiresAt < new Date()) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  res.json({ ok: true, email: row.email });
});

// ---------------------------------------------------------------------------
// GET /api/documents/folders?parentId=<uuid>  (omit for root)
// ---------------------------------------------------------------------------
router.get("/documents/folders", async (req, res): Promise<void> => {
  const parentId =
    typeof req.query.parentId === "string" ? req.query.parentId : undefined;

  const folders = await db
    .select()
    .from(docFoldersTable)
    .where(
      parentId
        ? eq(docFoldersTable.parentFolderId, parentId)
        : isNull(docFoldersTable.parentFolderId),
    )
    .orderBy(asc(docFoldersTable.name));

  res.json(folders);
});

// ---------------------------------------------------------------------------
// GET /api/documents/folders/:id
// ---------------------------------------------------------------------------
router.get("/documents/folders/:id", async (req, res): Promise<void> => {
  const [folder] = await db
    .select()
    .from(docFoldersTable)
    .where(eq(docFoldersTable.id, req.params.id as string));

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  res.json(folder);
});

// ---------------------------------------------------------------------------
// POST /api/documents/folders
// ---------------------------------------------------------------------------
router.post("/documents/folders", requireExec, async (req, res): Promise<void> => {
  const body = z
    .object({
      name: z.string().min(1).max(100),
      parentFolderId: z.string().uuid().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Folder name is required (max 100 chars)" });
    return;
  }

  const [folder] = await db
    .insert(docFoldersTable)
    .values({
      name: body.data.name,
      parentFolderId: body.data.parentFolderId ?? null,
      createdBy: (req as ExecRequest).execEmail,
    })
    .returning();

  res.status(201).json(folder);
});

// ---------------------------------------------------------------------------
// PATCH /api/documents/folders/:id
// ---------------------------------------------------------------------------
router.patch("/documents/folders/:id", requireExec, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const body = z
    .object({
      name: z.string().min(1).max(100).optional(),
      restrictedEmails: z.array(z.email()).nullable().optional(),
    })
    .safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const [folder] = await db
    .update(docFoldersTable)
    .set({
      ...(body.data.name !== undefined && { name: body.data.name }),
      ...(body.data.restrictedEmails !== undefined && {
        restrictedEmails: body.data.restrictedEmails,
      }),
      updatedAt: new Date(),
    })
    .where(eq(docFoldersTable.id, id))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }
  res.json(folder);
});

// ---------------------------------------------------------------------------
// DELETE /api/documents/folders/:id
// Files are cascade-deleted via the FK in the DB.
// ---------------------------------------------------------------------------
router.delete("/documents/folders/:id", requireExec, async (req, res): Promise<void> => {
  await db.delete(docFoldersTable).where(eq(docFoldersTable.id, req.params.id as string));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// GET /api/documents/folders/:id/files  (no content column)
// ---------------------------------------------------------------------------
router.get("/documents/folders/:id/files", async (req, res): Promise<void> => {
  const files = await db
    .select(FILE_META_COLS)
    .from(docFilesTable)
    .where(eq(docFilesTable.folderId, req.params.id as string))
    .orderBy(asc(docFilesTable.name));

  res.json(files);
});

// ---------------------------------------------------------------------------
// GET /api/documents/root-files  (files at root level, no content)
// ---------------------------------------------------------------------------
router.get("/documents/root-files", async (req, res): Promise<void> => {
  const files = await db
    .select(FILE_META_COLS)
    .from(docFilesTable)
    .where(isNull(docFilesTable.folderId))
    .orderBy(asc(docFilesTable.name));

  res.json(files);
});

// ---------------------------------------------------------------------------
// POST /api/documents/files/upload  (multipart/form-data, open to all)
// Body fields: folderId (optional uuid), name (optional display name),
//              uploadedBy (required — name or email of uploader)
// ---------------------------------------------------------------------------
router.post(
  "/documents/files/upload",
  upload.single("file"),
  async (req, res): Promise<void> => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const uploaderIdentity =
      typeof req.body.uploadedBy === "string" && req.body.uploadedBy.trim()
        ? req.body.uploadedBy.trim()
        : null;
    if (!uploaderIdentity) {
      res.status(400).json({ error: "Your name or email is required" });
      return;
    }

    const folderId =
      typeof req.body.folderId === "string" && req.body.folderId
        ? req.body.folderId
        : null;
    const displayName =
      typeof req.body.name === "string" && req.body.name
        ? req.body.name
        : file.originalname;

    const now = new Date();

    const [inserted] = await db
      .insert(docFilesTable)
      .values({
        folderId,
        name: displayName,
        content: file.buffer,
        size: file.size,
        mimeType: file.mimetype,
        uploadedBy: uploaderIdentity,
        lastModifiedBy: uploaderIdentity,
        lastModifiedAt: now,
      })
      .returning(FILE_META_COLS);

    res.status(201).json(inserted);
  },
);

// ---------------------------------------------------------------------------
// DELETE /api/documents/files/:id  (exec only)
// ---------------------------------------------------------------------------
router.delete("/documents/files/:id", requireExec, async (req, res): Promise<void> => {
  await db.delete(docFilesTable).where(eq(docFilesTable.id, req.params.id as string));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// GET /api/documents/files/:id/download
// For restricted folders: pass ?email=<email> or X-Exec-Token header.
// ---------------------------------------------------------------------------
router.get("/documents/files/:id/download", async (req, res): Promise<void> => {
  const requesterEmail =
    typeof req.query.email === "string" ? req.query.email.toLowerCase() : undefined;

  const execToken =
    typeof req.headers["x-exec-token"] === "string"
      ? req.headers["x-exec-token"]
      : undefined;
  const isExec = await resolveExecToken(execToken);

  const [fileMeta] = await db
    .select({
      id: docFilesTable.id,
      folderId: docFilesTable.folderId,
      name: docFilesTable.name,
      size: docFilesTable.size,
      mimeType: docFilesTable.mimeType,
    })
    .from(docFilesTable)
    .where(eq(docFilesTable.id, req.params.id as string));

  if (!fileMeta) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  if (!isExec && fileMeta.folderId) {
    const [folder] = await db
      .select({ restrictedEmails: docFoldersTable.restrictedEmails })
      .from(docFoldersTable)
      .where(eq(docFoldersTable.id, fileMeta.folderId));

    if (folder?.restrictedEmails !== null && folder?.restrictedEmails !== undefined) {
      if (!requesterEmail || !folder.restrictedEmails.includes(requesterEmail)) {
        res.status(403).json({ error: "Access denied. This folder is restricted." });
        return;
      }
    }
  }

  const [fileWithContent] = await db
    .select({ content: docFilesTable.content })
    .from(docFilesTable)
    .where(eq(docFilesTable.id, req.params.id as string));

  if (!fileWithContent) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const safeFilename = fileMeta.name.replace(/[^\w\s.\-]/g, "_");
  res.setHeader("Content-Type", fileMeta.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
  res.setHeader("Content-Length", String(fileMeta.size));
  res.send(fileWithContent.content);
});

export default router;
