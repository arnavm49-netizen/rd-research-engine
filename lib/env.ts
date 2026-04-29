/**
 * Environment validation.
 *
 * Schema covers env vars used by the Node.js side (web app + worker).
 * Variables specific to the Python ML service (QDRANT_*, ANTHROPIC_API_KEY)
 * are NOT validated here — that service has its own env loader.
 *
 * NEXTAUTH_SECRET is only required in the web app, not the worker.
 * It's marked optional here, and NextAuth itself will throw a clearer
 * error if it's missing when actually needed.
 */
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default("us-east-1"),
  ML_SERVICE_URL: z.string().url(),
  // Web-only — worker doesn't need it. NextAuth will surface a clearer
  // error than zod if it's actually missing at request time.
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  // Web-only — NextAuth v5 derives from request headers if absent.
  NEXTAUTH_URL: z.string().url().optional(),
  // Email used by Unpaywall API (free, just needs a contact address)
  UNPAYWALL_EMAIL: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}

export const env = getEnv();
