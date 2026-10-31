import { createServer } from "node:http";

/** One outstanding dependency probe, even when an unavailable driver never settles. */
export function workerReadiness(
  dependencies: () => Promise<void>,
  consuming: () => boolean,
  timeoutMs = 1500,
) {
  let pending: Promise<boolean> | undefined;
  return async () => {
    if (!consuming()) return false;
    if (!pending) {
      let timer: ReturnType<typeof setTimeout>;
      const deadline = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      });
      const probe = Promise.resolve()
        .then(dependencies)
        .then(
          () => true,
          () => false,
        )
        .finally(() => {
          clearTimeout(timer);
          pending = undefined;
        });
      pending = Promise.race([probe, deadline]);
    }
    return (await pending) && consuming();
  };
}

export function workerHealthServer(
  ready: () => Promise<boolean>,
  stopping: () => boolean,
) {
  return createServer((request, response) => {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    const send = (status: number, value: string) => {
      response.writeHead(status);
      response.end(JSON.stringify({ status: value }));
    };
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      send(405, "method_not_allowed");
    } else if (request.url === "/health") {
      send(stopping() ? 503 : 200, stopping() ? "stopping" : "ok");
    } else if (request.url === "/health/ready") {
      if (stopping()) send(503, "not_ready");
      else
        void ready().then(
          (healthy) =>
            send(
              healthy && !stopping() ? 200 : 503,
              healthy && !stopping() ? "ready" : "not_ready",
            ),
          () => send(503, "not_ready"),
        );
    } else send(404, "not_found");
  });
}
