import {
  type ArgumentMetadata,
  Body,
  type PipeTransform,
  Query,
  applyDecorators,
} from "@nestjs/common";
import { ApiBody } from "@nestjs/swagger";
import { z, type ZodType } from "zod";

/** Valide et transforme une entrée avec un schéma Zod (erreurs gérées par FiltreErreurs). */
export class PipeZod<T extends ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(valeur: unknown, _meta: ArgumentMetadata): z.output<T> {
    return this.schema.parse(valeur ?? {});
  }
}

function jsonSchema(schema: ZodType) {
  try {
    return z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<
      string,
      unknown
    >;
  } catch {
    return { type: "object" };
  }
}

/** Corps de requête validé par Zod et documenté dans OpenAPI. */
export const Corps = <T extends ZodType>(schema: T) => Body(new PipeZod(schema));
/** Paramètres de requête (query string) validés par Zod. */
export const Requete = <T extends ZodType>(schema: T) => Query(new PipeZod(schema));
/** Documente le corps attendu dans OpenAPI. */
export const DocCorps = (schema: ZodType) =>
  applyDecorators(ApiBody({ schema: jsonSchema(schema) as never }));
