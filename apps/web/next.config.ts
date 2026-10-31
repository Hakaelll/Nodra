import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { devOrigins } from "./lib/dev-origins";
// Next reads app-local env files; this monorepo keeps shared configuration at its root.
for (const path of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
]) {
  if (existsSync(path)) process.loadEnvFile(path);
}
const config = (phase: string): NextConfig => ({
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  allowedDevOrigins: devOrigins({
    NODRA_LAN_HOST: process.env.NODRA_LAN_HOST,
    WEB_ORIGIN: process.env.WEB_ORIGIN,
  }),
});
export default config;
