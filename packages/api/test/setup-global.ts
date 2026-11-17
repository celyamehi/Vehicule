import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { categoriesVehicule, migrer } from "@lvb/db";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const CATEGORIES = [
  {
    code: "citadine",
    ordre: 1,
    libelles: { fr: "Citadine", ar: "سيارة مدينة", kab: "Takeṛṛust n temdint" },
  },
  {
    code: "berline",
    ordre: 2,
    libelles: { fr: "Berline", ar: "سيدان", kab: "Takeṛṛust tameqqrant" },
  },
  { code: "suv", ordre: 3, libelles: { fr: "SUV", ar: "رباعية الدفع", kab: "SUV" } },
  {
    code: "utilitaire",
    ordre: 4,
    libelles: { fr: "Utilitaire", ar: "نفعية", kab: "Takeṛṛust n uxeddim" },
  },
  { code: "minibus", ordre: 5, libelles: { fr: "Minibus", ar: "حافلة صغيرة", kab: "Minibus" } },
];

/** Base de test vierge + migrations + référentiel des catégories. */
export default async function setup() {
  config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"), quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !/_test(\?|$)/.test(url))
    throw new Error("DATABASE_URL_TEST doit pointer vers une base *_test");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe(
    "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;",
  );
  await sql.end();
  await migrer(url);
  const client = postgres(url, { max: 1 });
  await drizzle(client, { casing: "snake_case" }).insert(categoriesVehicule).values(CATEGORIES);
  await client.end();
}
