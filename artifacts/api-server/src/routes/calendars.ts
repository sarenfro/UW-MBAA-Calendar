import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, calendarsTable } from "@workspace/db";
import { ListCalendarsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/calendars", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(calendarsTable)
    .where(eq(calendarsTable.isActive, true))
    .orderBy(calendarsTable.name);
  res.json(ListCalendarsResponse.parse(rows));
});

export default router;
