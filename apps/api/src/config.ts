import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  /**
   * CockroachDB (PostgreSQL wire protocol). Example (local insecure):
   * postgresql://root@127.0.0.1:26257/defaultdb?sslmode=disable
   */
  DATABASE_URL: z
    .string()
    .url()
    .default("postgresql://root@127.0.0.1:26257/defaultdb?sslmode=disable"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("dev-session-secret-change-me-32chars!!"),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  OIDC_MFA_AMR_VALUES: z.string().default("mfa otp pwd"),
  OIDC_MFA_ACR_HINT: z.string().optional(),
  PUBLIC_WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  OIDC_RECOVERY_PATH: z.string().default("/forgot-password"),
});

export type Config = z.infer<typeof envSchema>;

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}

export function resetConfigCache(): void {
  cached = null;
}
