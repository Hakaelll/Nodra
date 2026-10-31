import { afterEach, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { workerHealthServer, workerReadiness } from "./health";

const servers: Server[] = [];
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeIdleConnections();
        }),
    ),
  );
});

async function endpoint(ready: () => Promise<boolean>, stopping = () => false) {
  const server = workerHealthServer(ready, stopping);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test address");
  return `http://127.0.0.1:${address.port}`;
}

it("serves liveness independently of dependencies, with no cache", async () => {
  const ready = vi.fn(async () => false);
  const url = await endpoint(ready);
  const live = await fetch(`${url}/health`);
  expect(live.status).toBe(200);
  expect(await live.json()).toEqual({ status: "ok" });
  expect(live.headers.get("cache-control")).toBe("no-store");
  expect(ready).not.toHaveBeenCalled();
  const unavailable = await fetch(`${url}/health/ready`);
  expect(unavailable.status).toBe(503);
  expect(await unavailable.json()).toEqual({ status: "not_ready" });
});

it("returns readiness only after dependencies and consumer are healthy", async () => {
  const dependencies = vi.fn(async () => {});
  let consuming = true;
  const ready = workerReadiness(dependencies, () => consuming);
  const url = await endpoint(ready);
  const healthy = await fetch(`${url}/health/ready`);
  expect(healthy.status).toBe(200);
  expect(await healthy.json()).toEqual({ status: "ready" });
  consuming = false;
  expect((await fetch(`${url}/health/ready`)).status).toBe(503);
  expect(dependencies).toHaveBeenCalledTimes(1);
});

it("never exposes rejected dependency details", async () => {
  const ready = workerReadiness(
    async () => {
      throw new Error("postgres://secret-password@private-host private-stack");
    },
    () => true,
  );
  const url = await endpoint(ready);
  const response = await fetch(`${url}/health/ready`);
  expect(response.status).toBe(503);
  expect(await response.text()).toBe('{"status":"not_ready"}');
});

it("bounds a hanging probe, coalesces requests and recovers after it settles", async () => {
  vi.useFakeTimers();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const dependencies = vi
    .fn()
    .mockImplementationOnce(() => blocked)
    .mockResolvedValue(undefined);
  const ready = workerReadiness(dependencies, () => true, 100);
  const first = ready();
  const second = ready();
  await vi.advanceTimersByTimeAsync(100);
  expect(await first).toBe(false);
  expect(await second).toBe(false);
  expect(await ready()).toBe(false);
  expect(dependencies).toHaveBeenCalledTimes(1);
  release();
  await vi.advanceTimersByTimeAsync(0);
  expect(await ready()).toBe(true);
  expect(dependencies).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("rejects health during shutdown and rejects unrelated paths and methods", async () => {
  let stopping = false;
  const ready = vi.fn(async () => true);
  const url = await endpoint(ready, () => stopping);
  expect((await fetch(`${url}/unknown`)).status).toBe(404);
  const method = await fetch(`${url}/health`, { method: "POST" });
  expect(method.status).toBe(405);
  expect(method.headers.get("allow")).toBe("GET");
  stopping = true;
  expect((await fetch(`${url}/health`)).status).toBe(503);
  expect((await fetch(`${url}/health/ready`)).status).toBe(503);
  expect(ready).not.toHaveBeenCalled();
});

it("rechecks the consumer after an asynchronous probe", async () => {
  let consuming = true;
  const ready = workerReadiness(
    async () => {
      consuming = false;
    },
    () => consuming,
  );
  expect(await ready()).toBe(false);
});
