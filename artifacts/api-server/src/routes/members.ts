import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import type { Member } from "@workspace/db";
import {
  ListMembersQueryParams,
  ListMembersResponse,
  CreateMemberBody,
  UpdateMemberParams,
  UpdateMemberBody,
  UpdateMemberResponse,
  DeleteMemberParams,
  ListMembersResponseItem,
} from "@workspace/api-zod";

const router: IRouter = Router();

function shapeMember(row: Member) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    graduationYear: row.graduationYear,
    track: row.track,
    committee: row.committee,
    duesPaid: row.duesPaid,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

router.get("/members", async (req, res): Promise<void> => {
  const rawDuesPaid =
    typeof req.query.duesPaid === "string" ? req.query.duesPaid : undefined;
  const parsed = ListMembersQueryParams.safeParse({
    duesPaid: rawDuesPaid,
    track: req.query.track,
  });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const conditions = [];
  if (parsed.data.duesPaid !== undefined) {
    conditions.push(eq(membersTable.duesPaid, parsed.data.duesPaid));
  }
  if (parsed.data.track) {
    conditions.push(eq(membersTable.track, parsed.data.track));
  }

  const rows = await db
    .select()
    .from(membersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(membersTable.name));

  res.json(ListMembersResponse.parse(rows.map(shapeMember)));
});

router.post("/members", async (req, res): Promise<void> => {
  const parsed = CreateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const [row] = await db
      .insert(membersTable)
      .values({
        name: parsed.data.name,
        email: parsed.data.email,
        graduationYear: parsed.data.graduationYear,
        track: parsed.data.track ?? null,
        committee: parsed.data.committee ?? null,
        duesPaid: parsed.data.duesPaid ?? false,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    res.status(201).json(ListMembersResponseItem.parse(shapeMember(row)));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      res.status(409).json({ error: "A member with that email already exists" });
      return;
    }
    throw err;
  }
});

router.patch("/members/:id", async (req, res): Promise<void> => {
  const params = UpdateMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateMemberBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Partial<Member> = {};
  if (body.data.name !== undefined) updates.name = body.data.name;
  if (body.data.email !== undefined) updates.email = body.data.email;
  if (body.data.graduationYear !== undefined)
    updates.graduationYear = body.data.graduationYear;
  if (body.data.track !== undefined) updates.track = body.data.track;
  if (body.data.committee !== undefined) updates.committee = body.data.committee;
  if (body.data.duesPaid !== undefined) updates.duesPaid = body.data.duesPaid;
  if (body.data.notes !== undefined) updates.notes = body.data.notes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [row] = await db
    .update(membersTable)
    .set(updates)
    .where(eq(membersTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  res.json(UpdateMemberResponse.parse(shapeMember(row)));
});

router.delete("/members/:id", async (req, res): Promise<void> => {
  const params = DeleteMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(membersTable)
    .where(eq(membersTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  res.status(204).send();
});

export default router;
