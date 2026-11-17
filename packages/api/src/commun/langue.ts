import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import { type Langue, langueDepuis } from "@lvb/shared";
import type { Request } from "express";

/** Langue de la requête (en-tête Accept-Language), pour les SMS et messages traduits. */
export const LangueRequete = createParamDecorator((_d: unknown, ctx: ExecutionContext): Langue =>
  langueDepuis(ctx.switchToHttp().getRequest<Request>().headers["accept-language"]),
);
