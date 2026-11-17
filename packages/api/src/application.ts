import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { CONFIG, type Config } from "./config.js";

/** Construit l'application (utilisé par main.ts et par les tests). */
export async function creerApplication(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ["error", "warn", "log"],
    bodyParser: true,
  });
  const config = app.get<Config>(CONFIG);
  app.setGlobalPrefix("api/v1");
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.enableCors({
    origin: config.WEB_ORIGINS.split(",").map((o) => o.trim()),
    credentials: true,
    allowedHeaders: ["Authorization", "Content-Type", "Accept-Language", "X-Agence-Id"],
  });
  app.useBodyParser("json", { limit: "2mb" }); // signatures en data URL
  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle("API Location véhicules")
    .setDescription(
      "API REST v1 — plateforme client, logiciel loueur, back-office. Erreurs : { code, message, details }.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("api/v1/docs", app, SwaggerModule.createDocument(app, doc), {
    jsonDocumentUrl: "api/v1/openapi.json",
  });
  return app;
}
