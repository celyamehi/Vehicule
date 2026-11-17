import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

/** Charge le .env racine du monorepo, quel que soit le dossier courant. */
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"), quiet: true });
