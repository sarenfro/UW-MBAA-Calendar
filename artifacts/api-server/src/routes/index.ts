import { Router, type IRouter } from "express";
import healthRouter from "./health";
import calendarsRouter from "./calendars";
import eventsRouter from "./events";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(calendarsRouter);
router.use(eventsRouter);
router.use(dashboardRouter);

export default router;
