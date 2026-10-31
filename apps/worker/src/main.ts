import { Queue, Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { configuration } from "@nodra/config";
import pino from "pino";
import { ConsolePushProvider, MailpitProvider } from "./providers";
import { deliverEvent } from "./delivery";
import { OutboxDispatcher } from "./outbox";
import { deliverAuthActionEmails } from "./auth-mail";
import { workerHealthServer, workerReadiness } from "./health";
const config = configuration(),
  logger = pino();
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
});
const connection = { host: config.VALKEY_HOST, port: config.VALKEY_PORT };
const queue = new Queue(config.NOTIFICATION_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: { age: 7 * 86400 },
    removeOnFail: false,
  },
});
const push = new ConsolePushProvider(logger),
  mail = new MailpitProvider(
    config.SMTP_HOST,
    config.SMTP_PORT,
    config.MAIL_FROM,
  );
const worker = new Worker<{ eventId: string }>(
  config.NOTIFICATION_QUEUE_NAME,
  (job) => deliverEvent(db, job.data.eventId, push, mail),
  { connection, concurrency: 4 },
);
worker.on("failed", (job, error) =>
  logger.error(
    { jobId: job?.id, errorType: error.name },
    "Notification failed; inspect retained BullMQ job",
  ),
);
worker.on("error", (error) =>
  logger.error({ errorType: error.name }, "Worker connection error"),
);
queue.on("error", (error) =>
  logger.error({ errorType: error.name }, "Queue connection error"),
);
const dispatcher = new OutboxDispatcher(db, queue);
let activeDispatch: Promise<void> = Promise.resolve();
const dispatch = () => {
  activeDispatch = dispatcher
    .dispatch()
    .catch((error) =>
      logger.error(
        { errorType: error instanceof Error ? error.name : "Unknown" },
        "Outbox dispatch failed; will retry",
      ),
    );
};
const interval = setInterval(dispatch, 2000);
dispatch();
let activeAuthMail: Promise<void> = Promise.resolve();
let authMailRunning = false;
const dispatchAccountMail = () => {
  if (authMailRunning) return;
  authMailRunning = true;
  activeAuthMail = deliverAuthActionEmails(
    db,
    mail,
    config.JWT_SECRET,
    config.WEB_ORIGIN,
  )
    .catch((error) =>
      logger.error(
        { errorType: error instanceof Error ? error.name : "Unknown" },
        "Account mail dispatch failed; will retry",
      ),
    )
    .finally(() => {
      authMailRunning = false;
    });
};
const authMailInterval = setInterval(dispatchAccountMail, 5000);
dispatchAccountMail();
let stopping = false;
const readiness = workerReadiness(
  async () => {
    await Promise.all([
      db.$queryRaw`SELECT 1`,
      queue.client.then(async (client) => {
        if (client.status !== "ready") throw new Error("Valkey unavailable");
        await client.llen(queue.toKey("wait"));
      }),
      worker.client.then(async (client) => {
        if (client.status !== "ready")
          throw new Error("Consumer connection unavailable");
        await client.llen(queue.toKey("wait"));
      }),
    ]);
  },
  () => !stopping && worker.isRunning() && !worker.isPaused(),
);
const health = workerHealthServer(readiness, () => stopping);
health.on("error", (error) => {
  logger.error({ errorType: error.name }, "Worker health listener failed");
  process.exitCode = 1;
  void shutdown();
});
health.listen(config.WORKER_HEALTH_PORT, "127.0.0.1", () => {
  const address = health.address();
  if (address && typeof address !== "string")
    logger.info(
      { healthPort: address.port },
      "Worker health listening on loopback",
    );
});
async function shutdown() {
  if (stopping) return;
  stopping = true;
  health.close();
  health.closeIdleConnections();
  clearInterval(interval);
  clearInterval(authMailInterval);
  await activeDispatch;
  await activeAuthMail;
  await worker.close();
  await queue.close();
  await db.$disconnect();
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
