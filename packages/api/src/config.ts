import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as chargerEnv } from "dotenv";
import { z } from "zod";

// .env racine du monorepo (les variables déjà définies ne sont jamais écrasées).
chargerEnv({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
  quiet: true,
});

const booleen = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().min(8),
  JWT_REFRESH_SECRET: z.string().min(8),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL_JOURS: z.coerce.number().int().default(30),
  SMS_PROVIDER: z.enum(["console"]).default("console"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("lvb"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  /** Adresse publique du stockage vue par les navigateurs (URL signées). */
  S3_URL_PUBLIQUE: z.string().optional(),
  WEB_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001,http://localhost:3002"),
  /** Tâches planifiées BullMQ (désactivées dans les tests). */
  JOBS_ACTIFS: booleen.default(true),
  OTP_MAX_ENVOIS_PAR_HEURE: z.coerce.number().int().default(5),
  OTP_MAX_ESSAIS: z.coerce.number().int().default(5),
});

export type Config = z.infer<typeof schema>;

export function lireConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const r = schema.safeParse(env);
  if (!r.success) {
    const champs = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuration invalide (.env) : ${champs}`);
  }
  if (r.data.NODE_ENV === "production" && r.data.JWT_ACCESS_SECRET.startsWith("a_changer"))
    throw new Error("JWT_ACCESS_SECRET doit être changé en production");
  return r.data;
}

export const CONFIG = Symbol("CONFIG");
