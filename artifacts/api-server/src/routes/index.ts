import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarsRouter from "./calendars";
import eventsRouter from "./events";
import dashboardRouter from "./dashboard";
import membersRouter from "./members";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarsRouter);
router.use(eventsRouter);
router.use(dashboardRouter);
router.use(membersRouter);

export default router;
