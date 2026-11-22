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
import { entreprises, reservations, utilisateurs, vehicules } from "@lvb/db";
import { schemas } from "@lvb/shared";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";
import { versDto } from "../reservations/reservations.service.js";

/** Locations qui comptent dans le chiffre d'affaires (hors demandes, annulations, blocages). */
const STATUTS_FACTURABLES = sql`('confirmee', 'en_cours', 'terminee', 'litige')`;

/**
 * Montant facturé et montant payé des réservations d'une entreprise (sous-requêtes SQL).
 * Payé = acomptes + soldes + frais − remboursements (les cautions ne comptent pas).
 */
const totaux = (agenceId: string) => ({
  locations: sql<number>`(SELECT count(*)::int FROM reservations r
      WHERE r.entreprise_id = "entreprises"."id" AND r.agence_id = ${agenceId}
        AND r.statut IN ${STATUTS_FACTURABLES})`,
  chiffreAffaires: sql<number>`(SELECT coalesce(sum(r.prix_total + coalesce((r.frais_retour->>'total')::int, 0)), 0)::int
      FROM reservations r
      WHERE r.entreprise_id = "entreprises"."id" AND r.agence_id = ${agenceId}
        AND r.statut IN ${STATUTS_FACTURABLES})`,
  paye: sql<number>`(SELECT coalesce(sum(CASE WHEN p.type IN ('acompte','solde','frais') THEN p.montant
                                            WHEN p.type = 'remboursement' THEN -p.montant ELSE 0 END), 0)::int
      FROM paiements p JOIN reservations r ON r.id = p.reservation_id
      WHERE r.entreprise_id = "entreprises"."id" AND r.agence_id = ${agenceId}
        AND r.statut IN ${STATUTS_FACTURABLES} AND p.statut = 'reussi')`,
});

/** Clients entreprises : la location est facturée à la société, le conducteur reste un particulier. */
@ApiTags("Entreprises")
@ApiBearerAuth()
@RouteAgence()
@Controller("agence")
export class EntreprisesController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly journal: JournalService,
  ) {}

  private async entreprise(agenceId: string, id: string) {
    const [e] = await this.db
      .select()
      .from(entreprises)
      .where(and(eq(entreprises.id, id), eq(entreprises.agenceId, agenceId)));
    if (!e) throw introuvable();
    return e;
  }

  @Get("entreprises")
  async lister(
    @MonAgence() a: ContexteAgence,
    @Requete(z.object({ recherche: z.string().trim().max(100).optional() }))
    q: { recherche?: string },
  ) {
    const motif = q.recherche ? `%${q.recherche}%` : undefined;
    const lignes = await this.db
      .select({ e: entreprises, ...totaux(a.agenceId) })
      .from(entreprises)
      .where(
        and(
          eq(entreprises.agenceId, a.agenceId),
          motif
            ? or(
                ilike(entreprises.raisonSociale, motif),
                ilike(entreprises.nif, motif),
                ilike(entreprises.telephone, motif),
                ilike(entreprises.contactNom, motif),
              )
            : undefined,
        ),
      )
      .orderBy(asc(entreprises.raisonSociale))
      .limit(300);
    return lignes.map((l) => ({
      ...l.e,
      locations: l.locations,
      chiffreAffaires: l.chiffreAffaires,
      resteAPayer: Math.max(0, l.chiffreAffaires - l.paye),
    }));
  }

  @Get("entreprises/:id")
  async fiche(@MonAgence() a: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    const [l] = await this.db
      .select({ e: entreprises, ...totaux(a.agenceId) })
      .from(entreprises)
      .where(and(eq(entreprises.id, id), eq(entreprises.agenceId, a.agenceId)));
    if (!l) throw introuvable();
    const historique = await this.db
      .select({
        r: reservations,
        vehicule: sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
        conducteur: sql<
          string | null
        >`nullif(trim(coalesce(${utilisateurs.prenom}, '') || ' ' || coalesce(${utilisateurs.nom}, '')), '')`,
        telephone: utilisateurs.telephone,
      })
      .from(reservations)
      .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, reservations.clientId))
      .where(and(eq(reservations.agenceId, a.agenceId), eq(reservations.entrepriseId, id)))
      .orderBy(desc(reservations.debut))
      .limit(300);
    // Conducteurs : les particuliers qui ont conduit pour cette entreprise.
    const conducteurs = new Map<
      string,
      { utilisateurId: string; nom: string | null; telephone: string; locations: number }
    >();
    for (const h of historique) {
      if (!h.r.clientId || !h.telephone) continue;
      const c = conducteurs.get(h.r.clientId) ?? {
        utilisateurId: h.r.clientId,
        nom: h.conducteur,
        telephone: h.telephone,
        locations: 0,
      };
      c.locations += 1;
      conducteurs.set(h.r.clientId, c);
    }
    return {
      ...l.e,
      locations: l.locations,
      chiffreAffaires: l.chiffreAffaires,
      resteAPayer: Math.max(0, l.chiffreAffaires - l.paye),
      conducteurs: [...conducteurs.values()].sort((x, y) => y.locations - x.locations),
      historique: historique.map((h) => ({
        ...versDto(h.r),
        vehicule: h.vehicule,
        conducteur: h.conducteur,
        telephone: h.telephone,
      })),
    };
  }

  @Permission("reservations.creer")
  @Post("entreprises")
  @DocCorps(schemas.entrepriseCreer)
  async creer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.entrepriseCreer) c: z.output<typeof schemas.entrepriseCreer>,
  ) {
    const [e] = await this.db
      .insert(entreprises)
      .values({ ...c, agenceId: a.agenceId })
      .returning();
    await this.journal.noter({
      action: "entreprise.creer",
      entite: "entreprise",
      entiteId: e!.id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { raisonSociale: c.raisonSociale },
    });
    return e;
  }

  @Permission("reservations.creer")
  @Patch("entreprises/:id")
  @DocCorps(schemas.entrepriseModifier)
  async modifier(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.entrepriseModifier) c: z.output<typeof schemas.entrepriseModifier>,
  ) {
    // Comme pour les particuliers, seule la gérance décide de la liste noire.
    if (c.listeNoire !== undefined && a.role !== "gerant") throw new ErreurApi("ACCES_REFUSE");
    const [e] = await this.db
      .update(entreprises)
      .set({ ...c, updatedAt: new Date() })
      .where(and(eq(entreprises.id, id), eq(entreprises.agenceId, a.agenceId)))
      .returning();
    if (!e) throw introuvable();
    await this.journal.noter({
      action: c.listeNoire !== undefined ? "entreprise.liste_noire" : "entreprise.modifier",
      entite: "entreprise",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: c.listeNoire !== undefined ? { listeNoire: c.listeNoire } : {},
    });
    return e;
  }

  /** Suppression seulement sans location rattachée (sinon on garde l'historique de facturation). */
  @Permission("reservations.creer")
  @Delete("entreprises/:id")
  @HttpCode(204)
  async supprimer(@MonAgence() a: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    await this.entreprise(a.agenceId, id);
    const [{ n }] = (await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(reservations)
      .where(eq(reservations.entrepriseId, id))) as [{ n: number }];
    if (n > 0) throw new ErreurApi("CONFLIT", { raison: "historique" });
    await this.db
      .delete(entreprises)
      .where(and(eq(entreprises.id, id), eq(entreprises.agenceId, a.agenceId)));
  }

  /** Facturer une réservation existante à une entreprise (ou la rendre à un particulier). */
  @Permission("reservations.creer")
  @Patch("reservations/:id/entreprise")
  @DocCorps(schemas.reservationEntreprise)
  async rattacher(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.reservationEntreprise) c: z.output<typeof schemas.reservationEntreprise>,
  ) {
    if (c.entrepriseId) {
      const e = await this.entreprise(a.agenceId, c.entrepriseId);
      if (e.listeNoire) throw new ErreurApi("CLIENT_LISTE_NOIRE");
    }
    const [r] = await this.db
      .update(reservations)
      .set({ entrepriseId: c.entrepriseId, updatedAt: new Date() })
      .where(and(eq(reservations.id, id), eq(reservations.agenceId, a.agenceId)))
      .returning();
    if (!r) throw introuvable();
    await this.journal.noter({
      action: "reservation.entreprise",
      entite: "reservation",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { entrepriseId: c.entrepriseId },
    });
    return versDto(r);
  }
}
