import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { OPTIONS_RESERVABLES, schemas } from "@lvb/shared";
import { z } from "zod";
import { Public } from "../auth/decorateurs.js";
import { Requete } from "../commun/zod.js";
import { RechercheService } from "./recherche.service.js";

const prixRequete = schemas.periode.and(
  z.object({
    options: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((v) =>
        v === undefined ? [] : Array.isArray(v) ? v : v.split(",").filter(Boolean),
      )
      .pipe(z.array(z.enum(OPTIONS_RESERVABLES))),
    livraison: z
      .enum(["true", "false"])
      .optional()
      .transform((v) => v === "true"),
  }),
);

@ApiTags("Recherche")
@Controller()
export class RechercheController {
  constructor(private readonly recherche: RechercheService) {}

  @Public()
  @Get("recherche")
  rechercher(@Requete(schemas.rechercheParams) params: z.output<typeof schemas.rechercheParams>) {
    return this.recherche.rechercher(params);
  }

  @Public()
  @Get("vehicules/:id")
  fiche(@Param("id", ParseUUIDPipe) id: string) {
    return this.recherche.fiche(id);
  }

  @Public()
  @Get("vehicules/:id/prix")
  prix(
    @Param("id", ParseUUIDPipe) id: string,
    @Requete(prixRequete) q: z.output<typeof prixRequete>,
  ) {
    return this.recherche.prix(id, q.debut, q.fin, q.options, q.livraison);
  }
}
