import { config } from "dotenv";
config({ path: "../../.env", quiet: true });
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://lvb:lvb_dev@localhost:5432/lvb",
  },
  // Les tables PostGIS (spatial_ref_sys) ne sont pas gérées par Drizzle.
  extensionsFilters: ["postgis"],
});
