import type { PrismaClient } from "@prisma/client";

export interface OutboxQueue {
  getJob(id: string): Promise<unknown>;
  add(
    name: string,
    data: { eventId: string },
    options: { jobId: string },
  ): Promise<unknown>;
}

/** Rescans all unprocessed events, including ones whose queue entry was lost. */
export class OutboxDispatcher {
  private cursor: string | undefined;
  private running: Promise<void> | undefined;
  constructor(
    private readonly db: PrismaClient,
    private readonly queue: OutboxQueue,
    private readonly batchSize = 100,
  ) {}

  dispatch(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.scan().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async scan() {
    const events = await this.db.domainEvent.findMany({
      where: { processedAt: null },
      orderBy: { id: "asc" },
      take: this.batchSize,
      ...(this.cursor ? { cursor: { id: this.cursor }, skip: 1 } : {}),
    });
    for (const event of events) {
      // Existing delayed/active/failed jobs retain their retry state; only missing jobs are restored.
      if (!(await this.queue.getJob(event.id))) {
        await this.queue.add(
          event.kind,
          { eventId: event.id },
          { jobId: event.id },
        );
        await this.db.domainEvent.update({
          where: { id: event.id },
          data: { queuedAt: new Date() },
        });
      }
      this.cursor = event.id;
    }
    if (events.length < this.batchSize) this.cursor = undefined;
  }
}
