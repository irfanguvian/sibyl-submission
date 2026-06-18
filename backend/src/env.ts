import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_DIRECT_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Token lifetimes in seconds
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900), // 15 min
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(604800), // 7 days
  // Comma-separated CORS allowlist (Phase 7 hardening; tolerated earlier)
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // Object storage (MinIO / S3-compatible)
  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  // Endpoint used to mint presigned URLs handed to the browser. In Docker the
  // server reaches MinIO at http://minio:9000 (S3_ENDPOINT) but the browser
  // cannot resolve that host, so presign against a browser-reachable origin.
  // Defaults to S3_ENDPOINT when unset (host-dev + cloud deploys need no split).
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("documents"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  // Max upload size in bytes (default 10 MB)
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 1024 * 1024),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return result.data;
}
