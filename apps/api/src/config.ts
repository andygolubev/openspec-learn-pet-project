import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  DATABASE_PATH: z.string().default("./data/portal.db"),
  SESSION_SECRET: z
    .string()
    .min(32)
    .default("dev-session-secret-change-me-32chars!!"),
  OIDC_ISSUER: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().url().optional(),
  /** Space-separated amr values that count as MFA for internal users */
  OIDC_MFA_AMR_VALUES: z.string().default("mfa otp pwd"),
  /** If set, internal APIs require one of these substrings in acr claim */
  OIDC_MFA_ACR_HINT: z.string().optional(),
  PUBLIC_WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  /** Recovery URL template; {issuer} replaced at runtime for IdP recovery */
  OIDC_RECOVERY_PATH: z.string().default("/forgot-password"),
});

export type Config = z.infer<typeof envSchema>;

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  cached = envSchema.parse(process.env);
  return cached;
}

/** Tests may change env between cases */
export function resetConfigCache(): void {
  cached = null;
}
export function getDatabasePath(): string {
  const p = loadConfig().DATABASE_PATH;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

