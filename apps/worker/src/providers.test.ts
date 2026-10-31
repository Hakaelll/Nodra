import { describe, expect, it } from "vitest";
import type { Logger } from "pino";
import { ConsolePushProvider } from "./providers";

describe("ConsolePushProvider", () => {
  it("logs delivery identifiers without message content or extra metadata", async () => {
    const entries: unknown[] = [];
    const logger = {
      info: (fields: unknown) => entries.push(fields),
    } as unknown as Logger;
    const provider = new ConsolePushProvider(logger);
    await provider.send({
      recipient: "user-123",
      title: "private title",
      body: "private body",
      metadata: {
        eventId: "event-123",
        organizationId: "org-123",
        sensitive: "private metadata",
      },
    });
    expect(entries).toEqual([
      { recipientId: "user-123", eventId: "event-123" },
    ]);
  });
});
