import "../scripts/env.js";
import postgres from "postgres";
import { migrer } from "../src/migrer.js";

/** Remet la base de test à zéro puis applique toutes les migrations. */
export default async function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST manquant dans .env");
  if (!/_test(\?|$)/.test(url))
    throw new Error("DATABASE_URL_TEST doit pointer vers une base *_test");
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  await sql.unsafe(`
    DROP SCHEMA IF EXISTS drizzle CASCADE;
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
  `);
  await sql.end();
  await migrer(url);
}
