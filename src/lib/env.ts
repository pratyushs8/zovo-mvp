import { z } from "zod";

// Accepts "staging" at runtime even though Next.js only sets NODE_ENV to
// development/test/production — staging runs as NODE_ENV=production with
// APP_ENV=staging to distinguish it from real prod.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),

  // Postgres — used by Drizzle ORM
  DATABASE_URL: z.string().url(),

  // OpenAI Responses API
  OPENAI_API_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables — check .env.local against .env.example");
}

export const env = parsed.data;

export const isLocal = env.APP_ENV === "local";
export const isStaging = env.APP_ENV === "staging";
export const isProduction = env.APP_ENV === "production";
