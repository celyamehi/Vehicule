import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Base = ReturnType<typeof creerBase>["db"];

/**
 * Crée une connexion à PostgreSQL. Toutes les sessions tournent en Africa/Algiers.
 * Appeler `fermer()` à l'arrêt de l'application ou à la fin des tests.
 */
export function creerBase(url: string, options: { max?: number } = {}) {
  const sqlClient = postgres(url, {
    max: options.max ?? 10,
    connection: { TimeZone: "Africa/Algiers" },
    onnotice: () => {},
  });
  const db = drizzle(sqlClient, { schema, casing: "snake_case" });
  return { db, sql: sqlClient, fermer: () => sqlClient.end({ timeout: 5 }) };
}
