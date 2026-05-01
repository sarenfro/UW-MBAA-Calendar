import app from "./app";
import { logger } from "./lib/logger";
import { ensureCalendars } from "./lib/ensure-calendars";
import { ensureMembers } from "./lib/ensure-members";
import { syncAllCalendars } from "./lib/sync-calendars";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function runScheduledSync(): Promise<void> {
  logger.info("scheduledSync: starting");
  try {
    const results = await syncAllCalendars();
    const totalEvents = results.reduce((sum, r) => sum + r.events, 0);
    const skipped = results.filter((r) => r.skipped).map((r) => r.calendar);
    logger.info({ totalEvents, skipped }, "scheduledSync: complete");
  } catch (err) {
    logger.error({ err }, "scheduledSync: failed");
  }
}

async function start(): Promise<void> {
  await ensureCalendars();
  await ensureMembers();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Run an immediate sync on startup, then repeat every hour.
    runScheduledSync();
    setInterval(runScheduledSync, SYNC_INTERVAL_MS);
  });
}

start().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
