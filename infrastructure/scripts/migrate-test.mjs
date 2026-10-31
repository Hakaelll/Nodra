import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { testDatabaseUrl } from "./test-database.mjs";

const url = testDatabaseUrl(process.env.TEST_DATABASE_URL);
const require = createRequire(import.meta.url);
const cli = resolve(
  dirname(require.resolve("prisma/package.json")),
  "build/index.js",
);
execFileSync(process.execPath, [cli, "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: url },
  stdio: "inherit",
});
