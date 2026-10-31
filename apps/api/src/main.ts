import { configuration } from "@nodra/config";
import { createApp } from "./app";

const config = configuration();
const host =
  config.NODE_ENV === "production" ? "0.0.0.0" : config.API_BIND_HOST;

void createApp()
  .then((app) => app.listen(config.PORT, host))
  .catch((error) => {
    console.error(
      "API startup failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exitCode = 1;
  });
