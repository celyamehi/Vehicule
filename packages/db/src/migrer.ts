import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Dossier des migrations SQL versionnées (`packages/db/drizzle`). */
export const DOSSIER_MIGRATIONS = resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle");

/** Applique les migrations en attente sur la base `url`. */
export async function migrer(url: string): Promise<void> {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: DOSSIER_MIGRATIONS });
  } finally {
    await client.end({ timeout: 5 });
  }
}
