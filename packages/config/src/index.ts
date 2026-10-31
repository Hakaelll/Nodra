import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";
config({
  path: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
  quiet: true,
});
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(48),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BIND_HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(0).max(65535).default(4100),
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  VALKEY_HOST: z.string().default("127.0.0.1"),
  VALKEY_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  NOTIFICATION_QUEUE_NAME: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,79}$/)
    .default("nodra-notifications"),
  SMTP_HOST: z.string().default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  MAIL_FROM: z.string().default("Nodra <noreply@nodra.local>"),
  PUSH_PROVIDER: z.literal("console").default("console"),
  MAIL_PROVIDER: z.literal("mailpit").default("mailpit"),
  FCM_ENABLED: z.literal("false").default("false"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  LOCAL_OBJECT_STORAGE_ROOT: z.string().min(1).default(".local"),
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1).optional(),
  S3_SECRET_KEY: z.string().min(1).optional(),
  S3_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .optional(),
});
export function configuration() {
  const value = schema.parse(process.env);
  if (
    value.NODE_ENV === "production" &&
    value.JWT_SECRET.includes("development-only")
  )
    throw new Error("Replace development JWT_SECRET for production");
  if (value.STORAGE_PROVIDER === "s3") {
    if (
      !value.S3_ENDPOINT ||
      !value.S3_ACCESS_KEY ||
      !value.S3_SECRET_KEY ||
      !value.S3_BUCKET
    )
      throw new Error("S3 storage requires endpoint, credentials and bucket");
    const endpoint = new URL(value.S3_ENDPOINT);
    if (
      !["http:", "https:"].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.pathname !== "/" ||
      endpoint.search ||
      endpoint.hash ||
      (value.NODE_ENV === "production" && endpoint.protocol !== "https:")
    )
      throw new Error("Invalid S3 endpoint configuration");
  }
  return value;
}
