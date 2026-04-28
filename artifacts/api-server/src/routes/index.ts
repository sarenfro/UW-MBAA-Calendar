import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarsRouter from "./calendars";
import eventsRouter from "./events";
import dashboardRouter from "./dashboard";
import membersRouter from "./members";
import clubsRouter from "./clubs";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarsRouter);
router.use(eventsRouter);
router.use(dashboardRouter);
router.use(membersRouter);
router.use(clubsRouter);
router.use(adminRouter);

export default router;
