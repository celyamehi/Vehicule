import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { entretiens, reservations, vehicules } from "@lvb/db";
import { calculerRappels, dateAlger, prochaineEcheance, rentabilite, schemas } from "@lvb/shared";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";

/** Entretien de la flotte (section 4.10) : interventions, échéances, rappels, rentabilité. */
@ApiTags("Entretien")
@ApiBearerAuth()
@RouteAgence()
@Controller("agence")
export class EntretiensController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly journal: JournalService,
  ) {}

  private async vehicule(agenceId: string, id: string) {
    const [v] = await this.db
      .select()
      .from(vehicules)
      .where(and(eq(vehicules.id, id), eq(vehicules.agenceId, agenceId)));
    if (!v) throw introuvable();
    return v;
  }

  @Get("entretiens")
  async lister(
    @MonAgence() a: ContexteAgence,
    @Requete(z.object({ vehiculeId: z.uuid().optional() })) q: { vehiculeId?: string },
  ) {
    return this.db
      .select({
        e: entretiens,
        vehicule: sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
        immatriculation: vehicules.immatriculation,
      })
      .from(entretiens)
      .innerJoin(vehicules, eq(vehicules.id, entretiens.vehiculeId))
      .where(
        and(
          eq(entretiens.agenceId, a.agenceId),
          q.vehiculeId ? eq(entretiens.vehiculeId, q.vehiculeId) : undefined,
        ),
      )
      .orderBy(desc(entretiens.date), desc(entretiens.createdAt))
      .limit(300)
      .then((l) =>
        l.map((x) => ({ ...x.e, vehicule: x.vehicule, immatriculation: x.immatriculation })),
      );
  }

  /** Rappels de toute la flotte, du plus urgent au moins urgent. */
  @Get("entretiens/rappels")
  async rappels(@MonAgence() a: ContexteAgence) {
    const flotte = await this.db
      .select({
        id: vehicules.id,
        kilometrage: vehicules.kilometrage,
        marque: vehicules.marque,
        modele: vehicules.modele,
        immatriculation: vehicules.immatriculation,
      })
      .from(vehicules)
      .where(and(eq(vehicules.agenceId, a.agenceId), sql`${vehicules.statut} <> 'hors_service'`));
    if (!flotte.length) return [];
    const lignes = await this.db
      .select({
        vehiculeId: entretiens.vehiculeId,
        type: entretiens.type,
        date: entretiens.date,
        prochaineEcheanceDate: entretiens.prochaineEcheanceDate,
        prochaineEcheanceKm: entretiens.prochaineEcheanceKm,
      })
      .from(entretiens)
      .where(
        and(
          eq(entretiens.agenceId, a.agenceId),
          inArray(
            entretiens.vehiculeId,
            flotte.map((v) => v.id),
          ),
        ),
      );
    const infos = new Map(flotte.map((v) => [v.id, v]));
    return calculerRappels(lignes, flotte, dateAlger(new Date())).map((r) => {
      const v = infos.get(r.vehiculeId)!;
      return {
        ...r,
        vehicule: `${v.marque} ${v.modele}`,
        immatriculation: v.immatriculation,
        kilometrageActuel: v.kilometrage,
      };
    });
  }

  @Permission("flotte.modifier")
  @Post("entretiens")
  @DocCorps(schemas.entretienCreer)
  async creer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.entretienCreer) c: z.output<typeof schemas.entretienCreer>,
  ) {
    const v = await this.vehicule(a.agenceId, c.vehiculeId);
    // Échéance proposée par défaut si l'agence ne l'a pas saisie (null = aucune échéance voulue).
    const defaut = prochaineEcheance(c.type, c.date, c.kilometrage ?? null);
    const [e] = await this.db
      .insert(entretiens)
      .values({
        ...c,
        agenceId: a.agenceId,
        kilometrage: c.kilometrage ?? null,
        prochaineEcheanceDate:
          c.prochaineEcheanceDate === undefined ? defaut.date : c.prochaineEcheanceDate,
        prochaineEcheanceKm:
          c.prochaineEcheanceKm === undefined ? defaut.km : c.prochaineEcheanceKm,
        prestataire: c.prestataire ?? null,
        notes: c.notes ?? null,
        creePar: moi.id,
      })
      .returning();
    if (c.kilometrage && c.kilometrage > v.kilometrage)
      await this.db
        .update(vehicules)
        .set({ kilometrage: c.kilometrage })
        .where(eq(vehicules.id, v.id));
    await this.journal.noter({
      action: "entretien.creer",
      entite: "vehicule",
      entiteId: v.id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { type: c.type, cout: c.cout },
    });
    return e;
  }

  @Permission("flotte.modifier")
  @Patch("entretiens/:id")
  @DocCorps(schemas.entretienModifier)
  async modifier(
    @MonAgence() a: ContexteAgence,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.entretienModifier) c: z.output<typeof schemas.entretienModifier>,
  ) {
    await this.vehicule(a.agenceId, c.vehiculeId);
    const [e] = await this.db
      .update(entretiens)
      .set({
        ...c,
        kilometrage: c.kilometrage ?? null,
        prochaineEcheanceDate: c.prochaineEcheanceDate ?? null,
        prochaineEcheanceKm: c.prochaineEcheanceKm ?? null,
        prestataire: c.prestataire ?? null,
        notes: c.notes ?? null,
      })
      .where(and(eq(entretiens.id, id), eq(entretiens.agenceId, a.agenceId)))
      .returning();
    if (!e) throw introuvable();
    return e;
  }

  @Permission("flotte.modifier")
  @Delete("entretiens/:id")
  @HttpCode(204)
  async supprimer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const r = await this.db
      .delete(entretiens)
      .where(and(eq(entretiens.id, id), eq(entretiens.agenceId, a.agenceId)))
      .returning();
    if (!r.length) throw introuvable();
    await this.journal.noter({
      action: "entretien.supprimer",
      entite: "entretien",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
    });
  }

  /** Rentabilité (4.10) : revenus des locations réalisées moins les coûts d'entretien. */
  @Get("vehicules/:id/rentabilite")
  async rentabiliteVehicule(
    @MonAgence() a: ContexteAgence,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const v = await this.vehicule(a.agenceId, id);
    const [revenus] = (await this.db
      .select({
        total: sql<number>`coalesce(sum(${reservations.prixTotal} + coalesce((${reservations.fraisRetour}->>'total')::int, 0)), 0)::int`,
        locations: sql<number>`count(*)::int`,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.vehiculeId, id),
          eq(reservations.agenceId, a.agenceId),
          inArray(reservations.statut, ["en_cours", "terminee"]),
          sql`${reservations.origine} <> 'blocage'`,
        ),
      )) as [{ total: number; locations: number }];
    const [couts] = (await this.db
      .select({ total: sql<number>`coalesce(sum(${entretiens.cout}), 0)::int` })
      .from(entretiens)
      .where(and(eq(entretiens.vehiculeId, id), eq(entretiens.agenceId, a.agenceId)))) as [
      { total: number },
    ];
    return {
      vehiculeId: v.id,
      locations: revenus.locations,
      ...rentabilite(revenus.total, couts.total),
    };
  }
}
