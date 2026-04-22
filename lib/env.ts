import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default("us-east-1"),
  QDRANT_URL: z.string().url(),
  QDRANT_COLLECTION: z.string().default("research_documents"),
  ML_SERVICE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1),
  // Optional in production — NextAuth v5 derives from request headers if absent.
  // Set this once the final domain is known (custom domain or Render URL).
  NEXTAUTH_URL: z.string().url().optional(),
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
