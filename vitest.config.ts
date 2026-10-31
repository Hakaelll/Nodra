import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "apps/*/src/**/*.test.ts",
      "apps/web/lib/**/*.test.ts",
      "packages/*/src/**/*.test.ts",
      "infrastructure/scripts/**/*.test.mjs",
    ],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    environment: "node",
  },
});
