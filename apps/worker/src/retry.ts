import { Queue } from "bullmq";
import { configuration } from "@nodra/config";

async function retry() {
  const id = process.argv[2];
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error(
      "Provide exactly one event UUID: pnpm --filter @nodra/worker retry <event-id>",
    );
  const config = configuration();
  const queue = new Queue(config.NOTIFICATION_QUEUE_NAME, {
    connection: {
      host: config.VALKEY_HOST,
      port: config.VALKEY_PORT,
      maxRetriesPerRequest: 1,
    },
  });
  queue.on("error", () => {});
  try {
    const job = await queue.getJob(id);
    if (!job)
      throw new Error(
        "Job missing. The outbox dispatcher will restore unprocessed events.",
      );
    if ((await job.getState()) !== "failed")
      throw new Error("Only a failed job can be retried explicitly.");
    await job.retry("failed");
    console.log(
      "Failed job returned to the local queue. Delivery has not yet been verified.",
    );
  } finally {
    await queue.close();
  }
}
void retry().catch((error) => {
  console.error(error instanceof Error ? error.message : "Retry failed");
  process.exitCode = 1;
});
