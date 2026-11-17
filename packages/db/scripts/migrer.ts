import "./env.js";
import { migrer } from "../src/migrer.js";

const url = process.argv[2] === "--test" ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL (ou DATABASE_URL_TEST) manquant dans .env");
await migrer(url);
console.log("Migrations appliquées.");
