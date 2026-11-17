import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  agences,
  documentsIdentite,
  membresAgence,
  pointsRetrait,
  reservations,
  sessions,
  utilisateurs,
  vehicules,
} from "@lvb/db";
import {
  STATUTS_AGENCE,
  STATUTS_RESERVATION,
  dateAlger,
  depuisHeureAlger,
  schemas,
} from "@lvb/shared";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { Admin, Moi } from "../auth/decorateurs.js";
import type { UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";
import { Stockage } from "../fichiers/stockage.js";
import { versDto } from "../reservations/reservations.service.js";

/** Back-office de base (section 5, périmètre Phase 1). */
@ApiTags("Administration")
@ApiBearerAuth()
@Admin()
@Controller("admin")
export class AdminController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly journal: JournalService,
    private readonly stockage: Stockage,
  ) {}

  // ---------------------------------------------------------------------------
  // Agences : file de validation, suspension, commission
  // ---------------------------------------------------------------------------

  @Get("agences")
  agences(
    @Requete(
      z.object({
        statut: z.enum(STATUTS_AGENCE).optional(),
        recherche: z.string().max(100).optional(),
      }),
    )
    q: {
      statut?: (typeof STATUTS_AGENCE)[number];
      recherche?: string;
    },
  ) {
    return this.db
      .select({
        a: agences,
        vehicules: sql<number>`(SELECT count(*)::int FROM vehicules v WHERE v.agence_id = ${agences.id})`,
        gerant: sql<
          string | null
        >`(SELECT u.telephone FROM membres_agence m JOIN utilisateurs u ON u.id = m.utilisateur_id WHERE m.agence_id = ${agences.id} AND m.role = 'gerant' ORDER BY m.created_at LIMIT 1)`,
      })
      .from(agences)
      .where(
        and(
          q.statut ? eq(agences.statut, q.statut) : undefined,
          q.recherche
            ? or(
                ilike(agences.raisonSociale, `%${q.recherche}%`),
                ilike(agences.nif, `%${q.recherche}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(agences.statut), desc(agences.createdAt))
      .then((l) => l.map((x) => ({ ...x.a, nbVehicules: x.vehicules, telephoneGerant: x.gerant })));
  }

  @Get("agences/:id")
  async agence(@Moi() moi: UtilisateurConnecte, @Param("id", ParseUUIDPipe) id: string) {
    const [a] = await this.db.select().from(agences).where(eq(agences.id, id));
    if (!a) throw introuvable();
    const membres = await this.db
      .select({
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        telephone: utilisateurs.telephone,
        role: membresAgence.role,
      })
      .from(membresAgence)
      .innerJoin(utilisateurs, eq(utilisateurs.id, membresAgence.utilisateurId))
      .where(eq(membresAgence.agenceId, id));
    const points = await this.db.select().from(pointsRetrait).where(eq(pointsRetrait.agenceId, id));
    const [{ n }] = (await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(vehicules)
      .where(eq(vehicules.agenceId, id))) as [{ n: number }];
    if (a.justificatifs.length)
      await this.journal.noter({
        action: "document.consulter",
        entite: "agence",
        entiteId: id,
        utilisateurId: moi.id,
        details: { justificatifs: a.justificatifs.length },
      });
    return {
      ...a,
      justificatifsUrls: await Promise.all(a.justificatifs.map((c) => this.stockage.urlLecture(c))),
      photosUrls: await Promise.all(a.photos.map((c) => this.stockage.urlLecture(c, 3600))),
      membres,
      points,
      nbVehicules: n,
    };
  }

  /** Valider, suspendre ou réactiver une agence (seule une agence validée est visible sur le site). */
  @Post("agences/:id/decision")
  @HttpCode(200)
  @DocCorps(schemas.agenceDecision)
  async decider(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.agenceDecision) c: z.output<typeof schemas.agenceDecision>,
  ) {
    const statut = c.decision === "suspendre" ? "suspendue" : "validee";
    const [a] = await this.db
      .update(agences)
      .set({
        statut,
        motifStatut: c.motif ?? null,
        ...(c.decision === "valider" ? { valideeLe: new Date() } : {}),
        ...(c.tauxCommissionBp !== undefined ? { tauxCommissionBp: c.tauxCommissionBp } : {}),
      })
      .where(eq(agences.id, id))
      .returning();
    if (!a) throw introuvable();
    await this.journal.noter({
      action: `admin.agence.${c.decision}`,
      entite: "agence",
      entiteId: id,
      agenceId: id,
      utilisateurId: moi.id,
      details: c,
    });
    return a;
  }

  // ---------------------------------------------------------------------------
  // Réservations : recherche et suivi
  // ---------------------------------------------------------------------------

  @Get("reservations")
  async reservations(
    @Requete(
      schemas.pagination.extend({
        statut: z.enum(STATUTS_RESERVATION).optional(),
        recherche: z.string().trim().max(100).optional(),
      }),
    )
    q: {
      page: number;
      parPage: number;
      statut?: (typeof STATUTS_RESERVATION)[number];
      recherche?: string;
    },
  ) {
    const motif = q.recherche ? `%${q.recherche}%` : undefined;
    const lignes = await this.db
      .select({
        r: reservations,
        agence: agences.raisonSociale,
        client: utilisateurs.telephone,
        vehicule: sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
      })
      .from(reservations)
      .innerJoin(agences, eq(agences.id, reservations.agenceId))
      .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, reservations.clientId))
      .where(
        and(
          sql`${reservations.origine} <> 'blocage'`,
          q.statut ? eq(reservations.statut, q.statut) : undefined,
          motif
            ? or(
                ilike(reservations.code, motif),
                ilike(utilisateurs.telephone, motif),
                ilike(agences.raisonSociale, motif),
              )
            : undefined,
        ),
      )
      .orderBy(desc(reservations.createdAt))
      .limit(q.parPage)
      .offset((q.page - 1) * q.parPage);
    return lignes.map((l) => ({
      ...versDto(l.r),
      agence: l.agence,
      client: l.client,
      vehicule: l.vehicule,
    }));
  }

  // ---------------------------------------------------------------------------
  // Clients : vérification des documents, blocage des comptes
  // ---------------------------------------------------------------------------

  @Get("documents")
  async documents(@Moi() moi: UtilisateurConnecte) {
    const docs = await this.db
      .select({
        d: documentsIdentite,
        telephone: utilisateurs.telephone,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
      })
      .from(documentsIdentite)
      .innerJoin(utilisateurs, eq(utilisateurs.id, documentsIdentite.utilisateurId))
      .where(eq(documentsIdentite.statutVerification, "en_attente"))
      .orderBy(asc(documentsIdentite.createdAt))
      .limit(100);
    if (docs.length)
      await this.journal.noter({
        action: "document.consulter",
        entite: "documents_identite",
        utilisateurId: moi.id,
        details: { nombre: docs.length },
      });
    return Promise.all(
      docs.map(async ({ d, ...u }) => ({
        ...d,
        utilisateur: u,
        urls: {
          recto: d.fichiers.recto ? await this.stockage.urlLecture(d.fichiers.recto) : null,
          verso: d.fichiers.verso ? await this.stockage.urlLecture(d.fichiers.verso) : null,
        },
      })),
    );
  }

  @Post("documents/:id/decision")
  @HttpCode(200)
  @DocCorps(schemas.documentDecision)
  async deciderDocument(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.documentDecision) c: z.output<typeof schemas.documentDecision>,
  ) {
    const [d] = await this.db
      .update(documentsIdentite)
      .set({ statutVerification: c.decision, verifiePar: moi.id, verifieLe: new Date() })
      .where(eq(documentsIdentite.id, id))
      .returning();
    if (!d) throw introuvable();
    await this.journal.noter({
      action: `admin.document.${c.decision}`,
      entite: "document",
      entiteId: id,
      utilisateurId: moi.id,
    });
    return d;
  }

  @Get("utilisateurs")
  utilisateurs(
    @Requete(z.object({ recherche: z.string().trim().max(100).optional() }))
    q: {
      recherche?: string;
    },
  ) {
    const motif = q.recherche ? `%${q.recherche}%` : undefined;
    return this.db
      .select({
        id: utilisateurs.id,
        telephone: utilisateurs.telephone,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        statut: utilisateurs.statut,
        rolePlateforme: utilisateurs.rolePlateforme,
        createdAt: utilisateurs.createdAt,
      })
      .from(utilisateurs)
      .where(
        motif
          ? or(
              ilike(utilisateurs.telephone, motif),
              ilike(utilisateurs.nom, motif),
              ilike(utilisateurs.prenom, motif),
            )
          : undefined,
      )
      .orderBy(desc(utilisateurs.createdAt))
      .limit(100);
  }

  @Post("utilisateurs/:id/decision")
  @HttpCode(200)
  @DocCorps(schemas.utilisateurDecision)
  async deciderUtilisateur(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.utilisateurDecision) c: z.output<typeof schemas.utilisateurDecision>,
  ) {
    const [u] = await this.db
      .update(utilisateurs)
      .set({ statut: c.decision === "bloquer" ? "bloque" : "actif" })
      .where(and(eq(utilisateurs.id, id), sql`${utilisateurs.rolePlateforme} <> 'admin'`))
      .returning({ id: utilisateurs.id, statut: utilisateurs.statut });
    if (!u) throw introuvable();
    if (c.decision === "bloquer")
      await this.db
        .update(sessions)
        .set({ revoqueLe: new Date() })
        .where(and(eq(sessions.utilisateurId, id), isNull(sessions.revoqueLe)));
    await this.journal.noter({
      action: `admin.utilisateur.${c.decision}`,
      entite: "utilisateur",
      entiteId: id,
      utilisateurId: moi.id,
    });
    return u;
  }

  // ---------------------------------------------------------------------------
  // Statistiques (indicateurs de la section 15)
  // ---------------------------------------------------------------------------

  @Get("stats")
  async stats() {
    const aujourdhui = dateAlger(new Date());
    const debutMois = depuisHeureAlger(`${aujourdhui.slice(0, 7)}-01`);
    const [s] = (await this.db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM agences WHERE statut = 'validee') AS agences_validees,
        (SELECT count(*)::int FROM agences WHERE statut = 'en_attente') AS agences_en_attente,
        (SELECT count(DISTINCT agence_id)::int FROM journal_actions WHERE agence_id IS NOT NULL AND created_at > now() - interval '30 days') AS agences_actives,
        (SELECT count(*)::int FROM vehicules v JOIN agences a ON a.id = v.agence_id
           WHERE v.visible_plateforme AND a.statut = 'validee' AND v.statut <> 'hors_service') AS vehicules_visibles,
        (SELECT count(*)::int FROM reservations WHERE origine = 'plateforme' AND confirmee_le >= ${debutMois.toISOString()}::timestamptz) AS reservations_plateforme_mois,
        (SELECT coalesce(sum(prix_total), 0)::int FROM reservations WHERE origine = 'plateforme'
           AND statut IN ('confirmee', 'en_cours', 'terminee') AND confirmee_le >= ${debutMois.toISOString()}::timestamptz) AS ca_plateforme_mois,
        (SELECT count(*)::int FROM reservations WHERE origine = 'plateforme' AND created_at >= ${debutMois.toISOString()}::timestamptz) AS demandes_mois,
        (SELECT count(*)::int FROM reservations WHERE origine = 'plateforme' AND created_at >= ${debutMois.toISOString()}::timestamptz
           AND statut IN ('confirmee', 'en_cours', 'terminee', 'annulee_client', 'annulee_agence', 'non_presentation')) AS acceptees_mois,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM confirmee_le - created_at) / 60)
           FROM reservations WHERE origine = 'plateforme' AND confirmee_le IS NOT NULL AND created_at >= ${debutMois.toISOString()}::timestamptz) AS delai_median_minutes
    `)) as unknown as Record<string, number | null>[];
    const parWilaya = await this.db.execute(sql`
      SELECT a.wilaya, count(r.id)::int AS reservations, coalesce(sum(r.prix_total), 0)::int AS chiffre_affaires
      FROM reservations r JOIN agences a ON a.id = r.agence_id
      WHERE r.origine = 'plateforme' AND r.statut IN ('confirmee', 'en_cours', 'terminee')
      GROUP BY a.wilaya ORDER BY reservations DESC`);
    const parAgence = await this.db.execute(sql`
      SELECT a.id, a.raison_sociale, count(r.id)::int AS reservations, coalesce(sum(r.prix_total), 0)::int AS chiffre_affaires
      FROM agences a LEFT JOIN reservations r ON r.agence_id = a.id AND r.origine = 'plateforme' AND r.statut IN ('confirmee', 'en_cours', 'terminee')
      WHERE a.statut = 'validee'
      GROUP BY a.id ORDER BY reservations DESC LIMIT 20`);
    const demandes = Number(s!.demandes_mois ?? 0);
    return {
      agencesValidees: s!.agences_validees,
      agencesEnAttente: s!.agences_en_attente,
      agencesActives: s!.agences_actives,
      vehiculesVisibles: s!.vehicules_visibles,
      reservationsPlateformeMois: s!.reservations_plateforme_mois,
      chiffreAffairesPlateformeMois: s!.ca_plateforme_mois,
      tauxAcceptation: demandes
        ? Math.round((Number(s!.acceptees_mois) / demandes) * 1000) / 10
        : null,
      delaiMedianConfirmationMinutes:
        s!.delai_median_minutes === null ? null : Math.round(Number(s!.delai_median_minutes)),
      parWilaya,
      parAgence,
    };
  }
}
