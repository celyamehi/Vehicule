// Exécuté dans chaque processus de test, avant l'import de l'application.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"), quiet: true });
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST!;
process.env.JOBS_ACTIFS = "false";
process.env.OTP_MAX_ENVOIS_PAR_HEURE = "50";
