import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { categoriesVehicule } from "@lvb/db";
import { asc } from "drizzle-orm";
import { Public } from "./auth/decorateurs.js";
import { type Base, InjectBase } from "./base.js";

@ApiTags("Système")
@Controller()
export class SanteController {
  constructor(@InjectBase() private readonly db: Base) {}

  @Public()
  @Get("sante")
  sante() {
    return { statut: "ok", heure: new Date().toISOString() };
  }

  /** Référentiel des catégories (libellés fr / ar / kab). */
  @Public()
  @Get("categories")
  categories() {
    return this.db.select().from(categoriesVehicule).orderBy(asc(categoriesVehicule.ordre));
  }
}
