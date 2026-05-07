import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { eq, desc, and, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import { Resend } from "resend";
import {
  db,
  docExecTokensTable,
  ticketsTable,
  ticketMessagesTable,
} from "@workspace/db";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getVpEmail(): string | null {
  return (
    process.env.VP_TECH_EMAIL ??
    (process.env.EXEC_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)[0] ??
    null
  );
}

type ExecRequest = Request & { execEmail: string };

async function requireExec(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

async function resolveExecToken(
  token: string | undefined,
): Promise<string | null> {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(docExecTokensTable)
    .where(eq(docExecTokensTable.token, token));
  if (!row || row.expiresAt < new Date()) return null;
  return row.email;
}

async function sendEmail(
  req: Request,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    req.log.warn({ to, subject }, "RESEND_API_KEY not set, skipping email");
    return;
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM ?? "onboarding@resend.dev";
  await resend.emails.send({ from, to, subject, text });
}

// ---------------------------------------------------------------------------
// POST /api/tickets  —  submit a new ticket
// ---------------------------------------------------------------------------
router.post("/tickets", async (req, res): Promise<void> => {
  const body = z
    .object({
      title: z.string().min(3).max(200),
      description: z.string().min(10).max(5000),
      category: z
        .enum(["general", "technology", "event", "financial", "other"])
        .default("general"),
      submitterEmail: z.email(),
      submitterName: z.string().min(2).max(100),
    })
    .safeParse(req.body);

  if (!body.success) {
    res
      .status(400)
      .json({ error: "Please fill in all required fields correctly." });
    return;
  }

  const { title, description, category, submitterEmail, submitterName } =
    body.data;

  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      title,
      description,
      category,
      submitterEmail: submitterEmail.toLowerCase(),
      submitterName,
    })
    .returning();

  // Opening message = the description
  await db.insert(ticketMessagesTable).values({
    ticketId: ticket.id,
    senderEmail: submitterEmail.toLowerCase(),
    senderName: submitterName,
    isVp: false,
    content: description,
  });

  // Notify VP
  const vpEmail = getVpEmail();
  if (vpEmail) {
    const base = process.env.APP_BASE_URL ?? "http://localhost:80";
    await sendEmail(
      req,
      vpEmail,
      `New support ticket: ${title}`,
      [
        `A new support ticket has been submitted.`,
        ``,
        `From: ${submitterName} <${submitterEmail}>`,
        `Category: ${category}`,
        ``,
        description,
        ``,
        `View all tickets: ${base}/tickets/dashboard`,
      ].join("\n"),
    );
  }

  res.status(201).json(ticket);
});

// ---------------------------------------------------------------------------
// GET /api/tickets  —  list all tickets (exec only)
// ---------------------------------------------------------------------------
router.get("/tickets", requireExec, async (req, res): Promise<void> => {
  const statusParam =
    typeof req.query.status === "string" ? req.query.status : undefined;

  const validStatuses = ["open", "in_progress", "resolved"] as const;
  type ValidStatus = (typeof validStatuses)[number];

  const conditions: SQL[] = [];
  if (statusParam && (validStatuses as readonly string[]).includes(statusParam)) {
    conditions.push(
      eq(ticketsTable.status, statusParam as ValidStatus),
    );
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(ticketsTable.createdAt));

  res.json(tickets);
});

// ---------------------------------------------------------------------------
// GET /api/tickets/mine?email=...  —  list tickets by submitter email
// ---------------------------------------------------------------------------
router.get("/tickets/mine", async (req, res): Promise<void> => {
  const emailParam =
    typeof req.query.email === "string"
      ? req.query.email.toLowerCase()
      : null;
  if (!emailParam) {
    res.status(400).json({ error: "email query parameter is required" });
    return;
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.submitterEmail, emailParam))
    .orderBy(desc(ticketsTable.createdAt));

  res.json(tickets);
});

// ---------------------------------------------------------------------------
// GET /api/tickets/:id  —  get ticket + messages
// ---------------------------------------------------------------------------
router.get("/tickets/:id", async (req, res): Promise<void> => {
  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, req.params.id as string));

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const messages = await db
    .select()
    .from(ticketMessagesTable)
    .where(eq(ticketMessagesTable.ticketId, ticket.id))
    .orderBy(ticketMessagesTable.createdAt);

  res.json({ ...ticket, messages });
});

// ---------------------------------------------------------------------------
// POST /api/tickets/:id/messages  —  add a message
// VP replies require exec token; students reply using just the ticket ID
// ---------------------------------------------------------------------------
router.post("/tickets/:id/messages", async (req, res): Promise<void> => {
  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, req.params.id as string));

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const execToken = req.headers["x-exec-token"];
  const vpEmail = await resolveExecToken(
    typeof execToken === "string" ? execToken : undefined,
  );

  const body = z
    .object({
      content: z.string().min(1).max(5000),
    })
    .safeParse(req.body);

  if (!body.success) {
    res.status(400).json({ error: "Message content is required" });
    return;
  }

  const isVp = !!vpEmail;
  const senderEmail = isVp ? vpEmail : ticket.submitterEmail;
  const senderName = isVp ? "VP of Technology" : ticket.submitterName;

  const [message] = await db
    .insert(ticketMessagesTable)
    .values({
      ticketId: ticket.id,
      senderEmail,
      senderName,
      isVp,
      content: body.data.content,
    })
    .returning();

  await db
    .update(ticketsTable)
    .set({ updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticket.id));

  const base = process.env.APP_BASE_URL ?? "http://localhost:80";

  if (isVp) {
    await sendEmail(
      req,
      ticket.submitterEmail,
      `Update on your ticket: ${ticket.title}`,
      [
        `The VP of Technology has responded to your support ticket.`,
        ``,
        body.data.content,
        ``,
        `View your ticket: ${base}/tickets?id=${ticket.id}`,
      ].join("\n"),
    );
  } else {
    const vpNotifyEmail = getVpEmail();
    if (vpNotifyEmail) {
      await sendEmail(
        req,
        vpNotifyEmail,
        `Student replied on ticket: ${ticket.title}`,
        [
          `${ticket.submitterName} has added a reply to ticket #${ticket.id.slice(0, 8).toUpperCase()}.`,
          ``,
          body.data.content,
          ``,
          `View tickets: ${base}/tickets/dashboard`,
        ].join("\n"),
      );
    }
  }

  res.status(201).json(message);
});

// ---------------------------------------------------------------------------
// PATCH /api/tickets/:id/status  —  update status (exec only)
// ---------------------------------------------------------------------------
router.patch(
  "/tickets/:id/status",
  requireExec,
  async (req, res): Promise<void> => {
    const body = z
      .object({
        status: z.enum(["open", "in_progress", "resolved"]),
      })
      .safeParse(req.body);

    if (!body.success) {
      res
        .status(400)
        .json({ error: "status must be one of: open, in_progress, resolved" });
      return;
    }

    const [ticket] = await db
      .update(ticketsTable)
      .set({ status: body.data.status, updatedAt: new Date() })
      .where(eq(ticketsTable.id, req.params.id as string))
      .returning();

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const base = process.env.APP_BASE_URL ?? "http://localhost:80";
    const statusLabel: Record<string, string> = {
      open: "Open",
      in_progress: "In Progress",
      resolved: "Resolved",
    };

    await sendEmail(
      req,
      ticket.submitterEmail,
      `Your ticket status was updated: ${ticket.title}`,
      [
        `Your support ticket status has been updated to: ${statusLabel[ticket.status] ?? ticket.status}`,
        ``,
        `View your ticket: ${base}/tickets?id=${ticket.id}`,
      ].join("\n"),
    );

    res.json(ticket);
  },
);

export default router;
