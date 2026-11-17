import { Logger } from "@nestjs/common";
import { creerApplication } from "./application.js";
import { CONFIG, type Config } from "./config.js";

process.env.TZ ??= "UTC";
const app = await creerApplication();
const config = app.get<Config>(CONFIG);
await app.listen(config.API_PORT);
new Logger("API").log(
  `API prête sur http://localhost:${config.API_PORT}/api/v1 — documentation : /api/v1/docs`,
);
