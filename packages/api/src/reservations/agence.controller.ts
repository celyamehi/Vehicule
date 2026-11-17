import { Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { paiements, reservations, utilisateurs, vehicules } from "@lvb/db";
import { schemas } from "@lvb/shared";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";
import { ReservationsService, versDto } from "./reservations.service.js";

/** Réservations côté agence (section 9 : « Réservations agence »). */
@ApiTags("Réservations agence")
@ApiBearerAuth()
@RouteAgence()
@Controller("agence")
export class ReservationsAgenceController {
  constructor(
    private readonly reservations: ReservationsService,
    @InjectBase() private readonly db: Base,
    private readonly journal: JournalService,
  ) {}

  @Get("reservations")
  async lister(
    @MonAgence() a: ContexteAgence,
    @Requete(schemas.filtreReservations) f: z.output<typeof schemas.filtreReservations>,
  ) {
    const motif = f.recherche ? `%${f.recherche}%` : undefined;
    const conditions = and(
      eq(reservations.agenceId, a.agenceId),
      sql`${reservations.origine} <> 'blocage'`,
      f.statut ? eq(reservations.statut, f.statut) : undefined,
      f.debut ? gte(reservations.fin, f.debut) : undefined,
      f.fin ? lte(reservations.debut, f.fin) : undefined,
      motif
        ? or(
            ilike(reservations.code, motif),
            ilike(utilisateurs.nom, motif),
            ilike(utilisateurs.telephone, motif),
            ilike(vehicules.immatriculation, motif),
          )
        : undefined,
    );
    const lignes = await this.db
      .select({
        r: reservations,
        client: sql<
          string | null
        >`nullif(trim(coalesce(${utilisateurs.prenom}, '') || ' ' || coalesce(${utilisateurs.nom}, '')), '')`,
        telephone: utilisateurs.telephone,
        vehicule: sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
        immatriculation: vehicules.immatriculation,
      })
      .from(reservations)
      .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, reservations.clientId))
      .where(conditions)
      .orderBy(desc(reservations.debut))
      .limit(f.parPage)
      .offset((f.page - 1) * f.parPage);
    const [{ total }] = (await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(reservations)
      .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, reservations.clientId))
      .where(conditions)) as [{ total: number }];
    return {
      total,
      page: f.page,
      parPage: f.parPage,
      resultats: lignes.map((l) => ({
        ...versDto(l.r),
        client: l.client,
        telephone: l.telephone,
        vehicule: l.vehicule,
        immatriculation: l.immatriculation,
      })),
    };
  }

  @Get("reservations/:id")
  async detail(@MonAgence() a: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    const d = await this.reservations.detail(id, { agenceId: a.agenceId });
    const lesPaiements = await this.db
      .select()
      .from(paiements)
      .where(eq(paiements.reservationId, id))
      .orderBy(desc(paiements.createdAt));
    return { ...d, paiements: lesPaiements };
  }

  @Permission("reservations.creer")
  @Post("reservations")
  @DocCorps(schemas.reservationComptoirCreer)
  creer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.reservationComptoirCreer) c: z.output<typeof schemas.reservationComptoirCreer>,
  ) {
    return this.reservations.creerParAgence(a.agenceId, moi.id, c);
  }

  @Permission("reservations.accepter")
  @Post("reservations/:id/accepter")
  @HttpCode(200)
  accepter(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reservations.accepter(a.agenceId, id, moi.id);
  }

  @Permission("reservations.accepter")
  @Post("reservations/:id/refuser")
  @HttpCode(200)
  @DocCorps(schemas.reservationRefuser)
  refuser(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.reservationRefuser) c: z.output<typeof schemas.reservationRefuser>,
  ) {
    return this.reservations.refuser(a.agenceId, id, moi.id, c.motif);
  }

  @Permission("gerant")
  @Post("reservations/:id/annuler")
  @HttpCode(200)
  @DocCorps(schemas.reservationAnnuler)
  annuler(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.reservationAnnuler) c: z.output<typeof schemas.reservationAnnuler>,
  ) {
    return this.reservations.annulerParAgence(a.agenceId, id, moi.id, c.motif);
  }

  @Permission("reservations.depart_retour")
  @Post("reservations/:id/non-presentation")
  @HttpCode(200)
  nonPresentation(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reservations.nonPresentation(a.agenceId, id, moi.id);
  }

  @Permission("reservations.depart_retour")
  @Post("reservations/:id/depart")
  @HttpCode(200)
  depart(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reservations.depart(a.agenceId, id, moi.id);
  }

  @Permission("reservations.depart_retour")
  @Post("reservations/:id/retour")
  @HttpCode(200)
  @DocCorps(schemas.retourVehicule)
  retour(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.retourVehicule) c: z.output<typeof schemas.retourVehicule>,
  ) {
    return this.reservations.retour(a.agenceId, id, moi.id, c);
  }

  @Permission("reservations.creer")
  @Post("reservations/:id/prolonger")
  @HttpCode(200)
  @DocCorps(schemas.reservationProlonger)
  prolonger(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.reservationProlonger) c: z.output<typeof schemas.reservationProlonger>,
  ) {
    return this.reservations.prolonger(a.agenceId, id, moi.id, c.fin);
  }

  @Permission("reservations.creer")
  @Post("reservations/:id/reaffecter")
  @HttpCode(200)
  @DocCorps(schemas.reservationReaffecter)
  reaffecter(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.reservationReaffecter) c: z.output<typeof schemas.reservationReaffecter>,
  ) {
    return this.reservations.reaffecter(a.agenceId, id, moi.id, c.vehiculeId);
  }

  @Permission("encaissements")
  @Post("reservations/:id/paiements")
  @DocCorps(schemas.paiementEnregistrer)
  async encaisser(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.paiementEnregistrer) c: z.output<typeof schemas.paiementEnregistrer>,
  ) {
    await this.reservations.detail(id, { agenceId: a.agenceId }); // vérifie l'appartenance
    const [p] = await this.db
      .insert(paiements)
      .values({
        ...c,
        agenceId: a.agenceId,
        reservationId: id,
        statut: "reussi",
        enregistrePar: moi.id,
      })
      .returning();
    await this.journal.noter({
      action: `paiement.${c.type}`,
      entite: "reservation",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { montant: c.montant, moyen: c.moyen },
    });
    return p;
  }

  // Blocages manuels (4.4)

  @Permission("reservations.creer")
  @Post("blocages")
  @DocCorps(schemas.blocageCreer)
  bloquer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.blocageCreer) c: z.output<typeof schemas.blocageCreer>,
  ) {
    return this.reservations.bloquer(a.agenceId, moi.id, c);
  }

  @Permission("reservations.creer")
  @Delete("blocages/:id")
  @HttpCode(204)
  debloquer(@MonAgence() a: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    return this.reservations.debloquer(a.agenceId, id);
  }
}
