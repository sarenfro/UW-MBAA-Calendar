import { Router, type IRouter } from "express";
import { db, calendarsTable } from "@workspace/db";
import { ListCalendarsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/calendars", async (_req, res): Promise<void> => {
  const rows = await db.select().from(calendarsTable).orderBy(calendarsTable.id);
  res.json(ListCalendarsResponse.parse(rows));
});

export default router;
