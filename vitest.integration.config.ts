import "dotenv/config";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./infrastructure/scripts/test-database.mjs";
testDatabaseUrl(process.env.TEST_DATABASE_URL);
export default defineConfig({
  test: {
    include: ["apps/**/*.integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
