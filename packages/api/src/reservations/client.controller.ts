import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { schemas } from "@lvb/shared";
import type { z } from "zod";
import { Moi } from "../auth/decorateurs.js";
import type { UtilisateurConnecte } from "../auth/types.js";
import { Corps, DocCorps } from "../commun/zod.js";
import { ReservationsService } from "./reservations.service.js";

/** Réservations côté client (section 9 : « Réservations client »). */
@ApiTags("Réservations client")
@ApiBearerAuth()
@Controller()
export class ReservationsClientController {
  constructor(private readonly reservations: ReservationsService) {}

  @Post("reservations")
  @DocCorps(schemas.reservationClientCreer)
  creer(
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.reservationClientCreer) corps: z.output<typeof schemas.reservationClientCreer>,
  ) {
    return this.reservations.creerParClient(moi.id, corps);
  }

  @Get("moi/reservations")
  lister(@Moi() moi: UtilisateurConnecte) {
    return this.reservations.listerPourClient(moi.id);
  }

  @Get("moi/reservations/:id")
  detail(@Moi() moi: UtilisateurConnecte, @Param("id", ParseUUIDPipe) id: string) {
    return this.reservations.detail(id, { clientId: moi.id });
  }

  @Post("reservations/:id/annuler")
  @HttpCode(200)
  @DocCorps(schemas.reservationAnnuler)
  annuler(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.reservationAnnuler) corps: z.output<typeof schemas.reservationAnnuler>,
  ) {
    return this.reservations.annulerParClient(moi.id, id, corps.motif);
  }

  @Patch("reservations/:id/dates")
  @DocCorps(schemas.reservationDatesModifier)
  modifierDates(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.reservationDatesModifier)
    corps: z.output<typeof schemas.reservationDatesModifier>,
  ) {
    return this.reservations.modifierDates(moi.id, id, corps);
  }
}
