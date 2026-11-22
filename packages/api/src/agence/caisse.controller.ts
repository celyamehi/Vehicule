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
import { depenses, entretiens, paiements, reservations, vehicules } from "@lvb/db";
import {
  MS_JOUR,
  bilanCaisse,
  depuisHeureAlger,
  schemas,
  sensPaiement,
  statistiquesFlotte,
} from "@lvb/shared";
import { and, desc, eq, gt, gte, lt, lte, sql } from "drizzle-orm";
import type { z } from "zod";
import { MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";

type PeriodeJours = z.output<typeof schemas.periodeJours>;

/** Bornes instantanées d'une période en jours d'Alger : [du 00:00, au+1 00:00). */
const bornes = (p: PeriodeJours) => {
  const debut = depuisHeureAlger(p.du);
  const fin = new Date(depuisHeureAlger(p.au).getTime() + MS_JOUR);
  return { debut, fin, jours: Math.round((fin.getTime() - debut.getTime()) / MS_JOUR) };
};

const libelleVehicule = sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`;

/**
 * Dépenses, caisse et statistiques de la flotte.
 * Les paiements des locations entrent seuls dans la caisse ; les dépenses et les coûts
 * d'entretien en sortent (D43).
 */
@ApiTags("Caisse")
@ApiBearerAuth()
@RouteAgence()
@Controller("agence")
export class CaisseController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly journal: JournalService,
  ) {}

  private async verifierVehicule(agenceId: string, vehiculeId: string | null | undefined) {
    if (!vehiculeId) return;
    const [v] = await this.db
      .select({ id: vehicules.id })
      .from(vehicules)
      .where(and(eq(vehicules.id, vehiculeId), eq(vehicules.agenceId, agenceId)));
    if (!v) throw introuvable();
  }

  // ---------------------------------------------------------------------------
  // Dépenses
  // ---------------------------------------------------------------------------

  @Permission("encaissements")
  @Get("depenses")
  async lister(@MonAgence() a: ContexteAgence, @Requete(schemas.periodeJours) p: PeriodeJours) {
    const manuelles = await this.db
      .select({
        d: depenses,
        vehicule: libelleVehicule,
        immatriculation: vehicules.immatriculation,
      })
      .from(depenses)
      .leftJoin(vehicules, eq(vehicules.id, depenses.vehiculeId))
      .where(
        and(eq(depenses.agenceId, a.agenceId), gte(depenses.date, p.du), lte(depenses.date, p.au)),
      )
      .orderBy(desc(depenses.date), desc(depenses.createdAt));
    // Les coûts d'entretien sont déjà des dépenses : on les montre ici, en lecture seule.
    const dEntretien = await this.db
      .select({
        e: entretiens,
        vehicule: libelleVehicule,
        immatriculation: vehicules.immatriculation,
      })
      .from(entretiens)
      .innerJoin(vehicules, eq(vehicules.id, entretiens.vehiculeId))
      .where(
        and(
          eq(entretiens.agenceId, a.agenceId),
          gt(entretiens.cout, 0),
          gte(entretiens.date, p.du),
          lte(entretiens.date, p.au),
        ),
      )
      .orderBy(desc(entretiens.date));
    return [
      ...manuelles.map((x) => ({
        ...x.d,
        origine: "depense" as const,
        vehicule: x.vehicule,
        immatriculation: x.immatriculation,
      })),
      ...dEntretien.map((x) => ({
        id: x.e.id,
        origine: "entretien" as const,
        categorie: x.e.type,
        libelle: x.e.prestataire ?? "",
        montant: x.e.cout,
        date: x.e.date,
        vehiculeId: x.e.vehiculeId,
        moyen: null,
        notes: x.e.notes,
        vehicule: x.vehicule,
        immatriculation: x.immatriculation,
      })),
    ].sort((x, y) => y.date.localeCompare(x.date));
  }

  @Permission("encaissements")
  @Post("depenses")
  @DocCorps(schemas.depenseCreer)
  async creer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.depenseCreer) c: z.output<typeof schemas.depenseCreer>,
  ) {
    await this.verifierVehicule(a.agenceId, c.vehiculeId);
    const [d] = await this.db
      .insert(depenses)
      .values({
        ...c,
        vehiculeId: c.vehiculeId ?? null,
        moyen: c.moyen ?? null,
        notes: c.notes ?? null,
        agenceId: a.agenceId,
        creePar: moi.id,
      })
      .returning();
    await this.journal.noter({
      action: "depense.creer",
      entite: "depense",
      entiteId: d!.id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { montant: c.montant, categorie: c.categorie },
    });
    return d;
  }

  @Permission("encaissements")
  @Patch("depenses/:id")
  @DocCorps(schemas.depenseModifier)
  async modifier(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.depenseModifier) c: z.output<typeof schemas.depenseModifier>,
  ) {
    await this.verifierVehicule(a.agenceId, c.vehiculeId);
    const [d] = await this.db
      .update(depenses)
      .set({
        ...c,
        vehiculeId: c.vehiculeId ?? null,
        moyen: c.moyen ?? null,
        notes: c.notes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(depenses.id, id), eq(depenses.agenceId, a.agenceId)))
      .returning();
    if (!d) throw introuvable();
    await this.journal.noter({
      action: "depense.modifier",
      entite: "depense",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { montant: c.montant },
    });
    return d;
  }

  @Permission("encaissements")
  @Delete("depenses/:id")
  @HttpCode(204)
  async supprimer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const r = await this.db
      .delete(depenses)
      .where(and(eq(depenses.id, id), eq(depenses.agenceId, a.agenceId)))
      .returning();
    if (!r.length) throw introuvable();
    await this.journal.noter({
      action: "depense.supprimer",
      entite: "depense",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { montant: r[0]!.montant },
    });
  }

  // ---------------------------------------------------------------------------
  // Caisse
  // ---------------------------------------------------------------------------

  /** Entrées (paiements des locations), sorties (remboursements, dépenses, entretiens) et solde. */
  @Permission("encaissements")
  @Get("caisse")
  async caisse(@MonAgence() a: ContexteAgence, @Requete(schemas.periodeJours) p: PeriodeJours) {
    const { debut, fin } = bornes(p);
    const pmt = await this.db
      .select({
        p: paiements,
        code: reservations.code,
        vehicule: libelleVehicule,
      })
      .from(paiements)
      .innerJoin(reservations, eq(reservations.id, paiements.reservationId))
      .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
      .where(
        and(
          eq(paiements.agenceId, a.agenceId),
          eq(paiements.statut, "reussi"),
          gte(paiements.createdAt, debut),
          lt(paiements.createdAt, fin),
        ),
      );
    const sorties = await this.lister(a, p);

    const mouvements = [
      ...pmt.map((x) => ({
        id: x.p.id,
        origine: "paiement" as const,
        sens: sensPaiement(x.p.type),
        type: x.p.type as string,
        le: x.p.createdAt.toISOString(),
        jourSeul: false,
        montant: x.p.montant,
        moyen: x.p.moyen as string | null,
        reservationId: x.p.reservationId as string | null,
        code: x.code as string | null,
        vehicule: x.vehicule as string | null,
      })),
      ...sorties.map((d) => ({
        id: d.id,
        origine: d.origine,
        sens: "sortie" as const,
        type: d.categorie as string,
        le: depuisHeureAlger(d.date).toISOString(),
        jourSeul: true,
        montant: d.montant,
        moyen: d.moyen as string | null,
        reservationId: null,
        code: null,
        vehicule: d.vehicule,
        libelle: d.libelle,
      })),
    ].sort((x, y) => y.le.localeCompare(x.le));

    const bilan = bilanCaisse([
      ...pmt.map((x) => ({ origine: "paiement" as const, type: x.p.type, montant: x.p.montant })),
      ...sorties.map((d) => ({ origine: d.origine, montant: d.montant })),
    ]);

    // Répartition par moyen de paiement (espèces = argent présent au comptoir).
    const parMoyen = new Map<string, { entrees: number; sorties: number }>();
    for (const m of mouvements) {
      if (m.sens === "caution") continue;
      const cle = m.moyen ?? "non_precise";
      const t = parMoyen.get(cle) ?? { entrees: 0, sorties: 0 };
      if (m.sens === "entree") t.entrees += m.montant;
      else t.sorties += m.montant;
      parMoyen.set(cle, t);
    }

    return {
      ...bilan,
      parMoyen: [...parMoyen].map(([moyen, t]) => ({ moyen, ...t, solde: t.entrees - t.sorties })),
      mouvements: mouvements.slice(0, 500),
    };
  }

  // ---------------------------------------------------------------------------
  // Statistiques par véhicule (tableau de bord)
  // ---------------------------------------------------------------------------

  /** Véhicules les plus rentables et les plus loués sur la période. */
  @Permission("encaissements")
  @Get("statistiques/vehicules")
  async statistiques(
    @MonAgence() a: ContexteAgence,
    @Requete(schemas.periodeJours) p: PeriodeJours,
  ) {
    const { debut, fin, jours } = bornes(p);
    const d = debut.toISOString();
    const f = fin.toISOString();
    const lignes = (await this.db.execute(sql`
      SELECT v.id AS "vehiculeId",
             v.marque || ' ' || v.modele AS "nom",
             v.immatriculation,
             v.statut,
             coalesce(r.locations, 0)::int AS "locations",
             coalesce(r.jours, 0)::float AS "joursLoues",
             coalesce(r.revenus, 0)::int AS "revenus",
             (coalesce(dp.total, 0) + coalesce(en.total, 0))::int AS "couts"
        FROM vehicules v
        LEFT JOIN LATERAL (
          SELECT count(*) FILTER (WHERE x.debut >= ${d}::timestamptz AND x.debut < ${f}::timestamptz) AS locations,
                 sum(extract(epoch FROM least(coalesce(x.retour_le, x.fin), ${f}::timestamptz)
                                       - greatest(x.debut, ${d}::timestamptz)) / 86400) AS jours,
                 sum(x.prix_total + coalesce((x.frais_retour->>'total')::int, 0))
                   FILTER (WHERE x.debut >= ${d}::timestamptz AND x.debut < ${f}::timestamptz) AS revenus
            FROM reservations x
           WHERE x.vehicule_id = v.id
             AND x.origine <> 'blocage'
             AND x.statut IN ('confirmee', 'en_cours', 'terminee', 'litige')
             AND x.debut < ${f}::timestamptz
             AND coalesce(x.retour_le, x.fin) > ${d}::timestamptz
        ) r ON true
        LEFT JOIN LATERAL (
          SELECT sum(montant) AS total FROM depenses
           WHERE vehicule_id = v.id AND date BETWEEN ${p.du}::date AND ${p.au}::date
        ) dp ON true
        LEFT JOIN LATERAL (
          SELECT sum(cout) AS total FROM entretiens
           WHERE vehicule_id = v.id AND date BETWEEN ${p.du}::date AND ${p.au}::date
        ) en ON true
       WHERE v.agence_id = ${a.agenceId}
    `)) as unknown as {
      vehiculeId: string;
      nom: string;
      immatriculation: string;
      statut: string;
      locations: number;
      joursLoues: number;
      revenus: number;
      couts: number;
    }[];
    const infos = new Map(lignes.map((l) => [l.vehiculeId, l]));
    const s = statistiquesFlotte(
      lignes.map((l) => ({
        vehiculeId: l.vehiculeId,
        locations: Number(l.locations),
        joursLoues: Math.max(0, Number(l.joursLoues)),
        revenus: Number(l.revenus),
        couts: Number(l.couts),
      })),
      jours,
    );
    const enrichir = <T extends { vehiculeId: string }>(v: T) => {
      const i = infos.get(v.vehiculeId)!;
      return { ...v, nom: i.nom, immatriculation: i.immatriculation };
    };
    return {
      jours,
      totaux: s.totaux,
      plusRentables: s.plusRentables.map(enrichir),
      plusLoues: s.plusLoues.map(enrichir),
    };
  }
}
