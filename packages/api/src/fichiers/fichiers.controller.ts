import { Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { schemas } from "@lvb/shared";
import type { z } from "zod";
import { Moi } from "../auth/decorateurs.js";
import type { UtilisateurConnecte } from "../auth/types.js";
import { Corps, DocCorps } from "../commun/zod.js";
import { Stockage } from "./stockage.js";

@ApiTags("Fichiers")
@ApiBearerAuth()
@Controller("fichiers")
export class FichiersController {
  constructor(private readonly stockage: Stockage) {}

  /**
   * Demande une URL signée pour téléverser un fichier directement vers le stockage.
   * Les images sont compressées côté client (< 300 Ko) avant envoi.
   */
  @Post("televersement")
  @HttpCode(200)
  @DocCorps(schemas.demandeTeleversement)
  async televersement(
    @Corps(schemas.demandeTeleversement) corps: z.output<typeof schemas.demandeTeleversement>,
    @Moi() moi: UtilisateurConnecte,
  ) {
    const cle = Stockage.nouvelleCle(corps.usage, moi.id, corps.typeMime);
    return {
      cle,
      url: await this.stockage.urlTeleversement(cle, corps.typeMime, corps.taille),
      methode: "PUT",
    };
  }
}
