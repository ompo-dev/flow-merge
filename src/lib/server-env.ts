import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required."),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid URL."),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required."),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required."),
  ABACATEPAY_API_KEY: z.string().min(1).optional(),
  FLOW_MERGE_TRUSTED_ORIGINS: z.string().optional(),
});

let cachedServerEnv: z.infer<typeof serverEnvSchema> | null = null;

function isNonEmptyString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

export function getServerEnv() {
  if (cachedServerEnv) return cachedServerEnv;

  cachedServerEnv = serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    ABACATEPAY_API_KEY: process.env.ABACATEPAY_API_KEY,
    FLOW_MERGE_TRUSTED_ORIGINS: process.env.FLOW_MERGE_TRUSTED_ORIGINS,
  });

  return cachedServerEnv;
}

export function getTrustedOrigins() {
  const env = getServerEnv();
  const configured = env.FLOW_MERGE_TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(isNonEmptyString);

  return Array.from(
    new Set(
      [
        env.BETTER_AUTH_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "tauri://localhost",
        ...(configured ?? []),
      ].filter(isNonEmptyString),
    ),
  );
}
