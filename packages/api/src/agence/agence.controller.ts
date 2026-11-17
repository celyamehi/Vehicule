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
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import {
  agences,
  clientsAgence,
  documentsIdentite,
  journalActions,
  membresAgence,
  pointsRetrait,
  reservations,
  utilisateurs,
  vehicules,
} from "@lvb/db";
import { MS_JOUR, dateAlger, depuisHeureAlger, schemas } from "@lvb/shared";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";
import { Stockage } from "../fichiers/stockage.js";
import { versDto } from "../reservations/reservations.service.js";

const point = (lat?: number, lon?: number) =>
  lat !== undefined && lon !== undefined
    ? (sql`ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)::geography` as unknown as string)
    : null;

@ApiTags("Agence")
@ApiBearerAuth()
@Controller()
export class AgenceController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly journal: JournalService,
    private readonly stockage: Stockage,
  ) {}

  /**
   * Inscription d'une agence (4.1) : l'utilisateur devient gérant. Le logiciel est utilisable
   * immédiatement ; l'agence n'apparaît sur la marketplace qu'après validation par l'admin.
   */
  @Post("agences")
  @DocCorps(schemas.agenceInscrire)
  async inscrire(
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.agenceInscrire) c: z.output<typeof schemas.agenceInscrire>,
  ) {
    return this.db.transaction(async (tx) => {
      const [agence] = await tx
        .insert(agences)
        .values({ ...c, statut: "en_attente" })
        .returning();
      await tx
        .insert(membresAgence)
        .values({ agenceId: agence!.id, utilisateurId: moi.id, role: "gerant" });
      await tx.insert(pointsRetrait).values({
        agenceId: agence!.id,
        nom: "Agence principale",
        adresse: c.adresse,
        wilaya: c.wilaya,
        commune: "",
      });
      return agence!;
    });
  }

  @RouteAgence()
  @ApiHeader({ name: "X-Agence-Id", required: false })
  @Get("agence")
  async infos(@MonAgence() a: ContexteAgence) {
    const [agence] = await this.db.select().from(agences).where(eq(agences.id, a.agenceId));
    return { ...agence!, monRole: a.role, mesPermissions: a.permissions };
  }

  @RouteAgence()
  @Permission("gerant")
  @Patch("agence/parametres")
  @DocCorps(schemas.agenceParametres)
  async parametres(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.agenceParametres) c: z.output<typeof schemas.agenceParametres>,
  ) {
    const [agence] = await this.db
      .update(agences)
      .set(c)
      .where(eq(agences.id, a.agenceId))
      .returning();
    await this.journal.noter({
      action: "agence.parametres",
      entite: "agence",
      entiteId: a.agenceId,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: c,
    });
    return agence;
  }

  /** Tableau de bord du jour (4.2). */
  @RouteAgence()
  @Get("agence/tableau-de-bord")
  async tableauDeBord(@MonAgence() a: ContexteAgence) {
    const aujourdhui = dateAlger(new Date());
    const debutJour = depuisHeureAlger(aujourdhui);
    const finJour = new Date(debutJour.getTime() + MS_JOUR);
    const debutMois = depuisHeureAlger(`${aujourdhui.slice(0, 7)}-01`);
    const [annee, mois] = aujourdhui.split("-").map(Number) as [number, number];
    const finMois = depuisHeureAlger(
      mois === 12 ? `${annee + 1}-01-01` : `${annee}-${String(mois + 1).padStart(2, "0")}-01`,
    );

    const liste = (filtre: ReturnType<typeof and>) =>
      this.db
        .select({
          id: reservations.id,
          code: reservations.code,
          statut: reservations.statut,
          origine: reservations.origine,
          debut: reservations.debut,
          fin: reservations.fin,
          expireLe: reservations.expireLe,
          vehicule: sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
          immatriculation: vehicules.immatriculation,
          client: sql<
            string | null
          >`nullif(trim(coalesce(${utilisateurs.prenom}, '') || ' ' || coalesce(${utilisateurs.nom}, '')), '')`,
          telephone: utilisateurs.telephone,
        })
        .from(reservations)
        .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
        .leftJoin(utilisateurs, eq(utilisateurs.id, reservations.clientId))
        .where(
          and(
            eq(reservations.agenceId, a.agenceId),
            sql`${reservations.origine} <> 'blocage'`,
            filtre,
          ),
        )
        .orderBy(asc(reservations.debut));

    const [departs, retours, enAttente, retards] = await Promise.all([
      liste(
        and(
          eq(reservations.statut, "confirmee"),
          gte(reservations.debut, debutJour),
          lt(reservations.debut, finJour),
        ),
      ),
      liste(
        and(
          eq(reservations.statut, "en_cours"),
          gte(reservations.fin, debutJour),
          lt(reservations.fin, finJour),
        ),
      ),
      liste(eq(reservations.statut, "en_attente_agence")),
      liste(and(eq(reservations.statut, "en_cours"), lt(reservations.fin, new Date()))),
    ]);

    const [flotte] = (await this.db.execute(sql`
      SELECT count(*)::int AS vehicules,
             coalesce(sum(extract(epoch FROM (
               SELECT sum(upper(r.periode * tstzrange(${debutMois.toISOString()}::timestamptz, ${finMois.toISOString()}::timestamptz))
                        - lower(r.periode * tstzrange(${debutMois.toISOString()}::timestamptz, ${finMois.toISOString()}::timestamptz)))
               FROM reservations r
               WHERE r.vehicule_id = v.id AND r.origine <> 'blocage'
                 AND r.statut IN ('confirmee', 'en_cours', 'terminee')
                 AND r.periode && tstzrange(${debutMois.toISOString()}::timestamptz, ${finMois.toISOString()}::timestamptz)
             ))), 0)::float AS secondes_louees
      FROM vehicules v
      WHERE v.agence_id = ${a.agenceId} AND v.statut <> 'hors_service'
    `)) as unknown as { vehicules: number; secondes_louees: number }[];
    const secondesMois = (finMois.getTime() - debutMois.getTime()) / 1000;

    const ca = (await this.db
      .select({
        origine: reservations.origine,
        montant: sql<number>`coalesce(sum(${reservations.prixTotal}), 0)::int`,
        nombre: sql<number>`count(*)::int`,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.agenceId, a.agenceId),
          inArray(reservations.statut, ["confirmee", "en_cours", "terminee"]),
          gte(reservations.debut, debutMois),
          lt(reservations.debut, finMois),
        ),
      )
      .groupBy(reservations.origine)) as { origine: string; montant: number; nombre: number }[];
    const total = ca.reduce((s, l) => s + l.montant, 0);
    const enLigne = ca.find((l) => l.origine === "plateforme")?.montant ?? 0;

    return {
      date: aujourdhui,
      departs,
      retours,
      enAttente,
      retards,
      tauxOccupation:
        flotte && flotte.vehicules
          ? Math.round((flotte.secondes_louees / (flotte.vehicules * secondesMois)) * 1000) / 10
          : 0,
      chiffreAffairesMois: total,
      partEnLigne: total ? Math.round((enLigne / total) * 1000) / 10 : 0,
      reservationsMois: ca.reduce((s, l) => s + l.nombre, 0),
    };
  }

  /** Planning type Gantt (4.4) : une ligne par véhicule, réservations et blocages de la période. */
  @RouteAgence()
  @Get("agence/planning")
  async planning(
    @MonAgence() a: ContexteAgence,
    @Requete(schemas.planningParams) p: z.output<typeof schemas.planningParams>,
  ) {
    const flotte = await this.db
      .select({
        id: vehicules.id,
        marque: vehicules.marque,
        modele: vehicules.modele,
        immatriculation: vehicules.immatriculation,
        categorieId: vehicules.categorieId,
        statut: vehicules.statut,
      })
      .from(vehicules)
      .where(eq(vehicules.agenceId, a.agenceId))
      .orderBy(asc(vehicules.categorieId), asc(vehicules.marque));
    const lignes = await this.db
      .select({
        r: reservations,
        client: sql<
          string | null
        >`nullif(trim(coalesce(${utilisateurs.prenom}, '') || ' ' || coalesce(${utilisateurs.nom}, '')), '')`,
      })
      .from(reservations)
      .leftJoin(utilisateurs, eq(utilisateurs.id, reservations.clientId))
      .where(
        and(
          eq(reservations.agenceId, a.agenceId),
          inArray(reservations.statut, [
            "en_attente_paiement",
            "en_attente_agence",
            "confirmee",
            "en_cours",
            "terminee",
          ]),
          sql`${reservations.periode} && tstzrange(${p.debut.toISOString()}::timestamptz, ${p.fin.toISOString()}::timestamptz)`,
        ),
      );
    return {
      vehicules: flotte,
      reservations: lignes.map((l) => ({ ...versDto(l.r), client: l.client })),
    };
  }

  // ---------------------------------------------------------------------------
  // Points de retrait
  // ---------------------------------------------------------------------------

  @RouteAgence()
  @Get("agence/points-retrait")
  async points(@MonAgence() a: ContexteAgence) {
    return this.db.execute(sql`
      SELECT id, nom, adresse, wilaya, commune, horaires, actif,
             ST_Y(position::geometry) AS lat, ST_X(position::geometry) AS lon
      FROM points_retrait WHERE agence_id = ${a.agenceId} ORDER BY created_at`);
  }

  @RouteAgence()
  @Permission("gerant")
  @Post("agence/points-retrait")
  @DocCorps(schemas.pointRetraitCreer)
  async creerPoint(
    @MonAgence() a: ContexteAgence,
    @Corps(schemas.pointRetraitCreer) c: z.output<typeof schemas.pointRetraitCreer>,
  ) {
    const { lat, lon, ...reste } = c;
    const [p] = await this.db
      .insert(pointsRetrait)
      .values({ ...reste, agenceId: a.agenceId, position: point(lat, lon) })
      .returning();
    return p;
  }

  @RouteAgence()
  @Permission("gerant")
  @Patch("agence/points-retrait/:id")
  async modifierPoint(
    @MonAgence() a: ContexteAgence,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.pointRetraitCreer.partial().extend({ actif: z.boolean().optional() }))
    c: Partial<z.output<typeof schemas.pointRetraitCreer>> & { actif?: boolean },
  ) {
    const { lat, lon, ...reste } = c;
    const [p] = await this.db
      .update(pointsRetrait)
      .set({
        ...reste,
        ...(lat !== undefined && lon !== undefined ? { position: point(lat, lon) } : {}),
      })
      .where(and(eq(pointsRetrait.id, id), eq(pointsRetrait.agenceId, a.agenceId)))
      .returning();
    if (!p) throw introuvable();
    return p;
  }

  // ---------------------------------------------------------------------------
  // Équipe (4.11)
  // ---------------------------------------------------------------------------

  @RouteAgence()
  @Get("agence/membres")
  membres(@MonAgence() a: ContexteAgence) {
    return this.db
      .select({
        id: membresAgence.id,
        utilisateurId: utilisateurs.id,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        telephone: utilisateurs.telephone,
        role: membresAgence.role,
        permissions: membresAgence.permissions,
        actif: membresAgence.actif,
      })
      .from(membresAgence)
      .innerJoin(utilisateurs, eq(utilisateurs.id, membresAgence.utilisateurId))
      .where(eq(membresAgence.agenceId, a.agenceId));
  }

  @RouteAgence()
  @Permission("gerant")
  @Post("agence/membres")
  @DocCorps(schemas.membreAjouter)
  async ajouterMembre(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.membreAjouter) c: z.output<typeof schemas.membreAjouter>,
  ) {
    const [u] = await this.db
      .insert(utilisateurs)
      .values({ telephone: c.telephone, nom: c.nom, prenom: c.prenom })
      .onConflictDoUpdate({ target: utilisateurs.telephone, set: { updatedAt: new Date() } })
      .returning();
    const [m] = await this.db
      .insert(membresAgence)
      .values({
        agenceId: a.agenceId,
        utilisateurId: u!.id,
        role: c.role,
        permissions: c.permissions,
      })
      .onConflictDoUpdate({
        target: [membresAgence.agenceId, membresAgence.utilisateurId],
        set: { role: c.role, permissions: c.permissions, actif: true },
      })
      .returning();
    await this.journal.noter({
      action: "equipe.ajouter",
      entite: "membre",
      entiteId: m!.id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { role: c.role, permissions: c.permissions },
    });
    return m;
  }

  @RouteAgence()
  @Permission("gerant")
  @Patch("agence/membres/:id")
  async modifierMembre(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(
      schemas.membreAjouter
        .pick({ role: true, permissions: true })
        .partial()
        .extend({ actif: z.boolean().optional() }),
    )
    c: { role?: "gerant" | "employe"; permissions?: string[]; actif?: boolean },
  ) {
    const [m] = await this.db
      .update(membresAgence)
      .set(c)
      .where(and(eq(membresAgence.id, id), eq(membresAgence.agenceId, a.agenceId)))
      .returning();
    if (!m) throw introuvable();
    await this.journal.noter({
      action: "equipe.modifier",
      entite: "membre",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: c,
    });
    return m;
  }

  /** Journal des actions de l'agence (qui a fait quoi). */
  @RouteAgence()
  @Permission("gerant")
  @Get("agence/journal")
  journalAgence(@MonAgence() a: ContexteAgence) {
    return this.db
      .select({
        j: journalActions,
        auteur: sql<string | null>`${utilisateurs.prenom} || ' ' || ${utilisateurs.nom}`,
      })
      .from(journalActions)
      .leftJoin(utilisateurs, eq(utilisateurs.id, journalActions.utilisateurId))
      .where(eq(journalActions.agenceId, a.agenceId))
      .orderBy(desc(journalActions.createdAt))
      .limit(200);
  }

  // ---------------------------------------------------------------------------
  // Clients (4.7)
  // ---------------------------------------------------------------------------

  @RouteAgence()
  @Get("agence/clients")
  clients(
    @MonAgence() a: ContexteAgence,
    @Requete(z.object({ recherche: z.string().trim().max(100).optional() }))
    q: { recherche?: string },
  ) {
    const motif = q.recherche ? `%${q.recherche}%` : undefined;
    return this.db
      .select({
        utilisateurId: utilisateurs.id,
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        telephone: utilisateurs.telephone,
        listeNoire: clientsAgence.listeNoire,
        notesInternes: clientsAgence.notesInternes,
        reservations: sql<number>`(SELECT count(*)::int FROM reservations r WHERE r.client_id = ${utilisateurs.id} AND r.agence_id = ${a.agenceId})`,
      })
      .from(clientsAgence)
      .innerJoin(utilisateurs, eq(utilisateurs.id, clientsAgence.utilisateurId))
      .where(
        and(
          eq(clientsAgence.agenceId, a.agenceId),
          motif
            ? or(
                ilike(utilisateurs.nom, motif),
                ilike(utilisateurs.prenom, motif),
                ilike(utilisateurs.telephone, motif),
              )
            : undefined,
        ),
      )
      .orderBy(asc(utilisateurs.nom))
      .limit(200);
  }

  @RouteAgence()
  @Get("agence/clients/:utilisateurId")
  async client(@MonAgence() a: ContexteAgence, @Param("utilisateurId", ParseUUIDPipe) id: string) {
    const [fiche] = await this.db
      .select({ c: clientsAgence, u: utilisateurs })
      .from(clientsAgence)
      .innerJoin(utilisateurs, eq(utilisateurs.id, clientsAgence.utilisateurId))
      .where(and(eq(clientsAgence.agenceId, a.agenceId), eq(clientsAgence.utilisateurId, id)));
    if (!fiche) throw introuvable();
    const historique = await this.db
      .select()
      .from(reservations)
      .where(and(eq(reservations.agenceId, a.agenceId), eq(reservations.clientId, id)))
      .orderBy(desc(reservations.debut));
    return {
      utilisateurId: fiche.u.id,
      nom: fiche.u.nom,
      prenom: fiche.u.prenom,
      telephone: fiche.u.telephone,
      dateNaissance: fiche.u.dateNaissance,
      notesInternes: fiche.c.notesInternes,
      listeNoire: fiche.c.listeNoire,
      motifListeNoire: fiche.c.motifListeNoire,
      historique: historique.map(versDto),
    };
  }

  @RouteAgence()
  @Patch("agence/clients/:utilisateurId")
  @DocCorps(schemas.clientAgenceModifier)
  async modifierClient(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("utilisateurId", ParseUUIDPipe) id: string,
    @Corps(schemas.clientAgenceModifier) c: z.output<typeof schemas.clientAgenceModifier>,
  ) {
    if (c.listeNoire !== undefined && a.role !== "gerant") throw new ErreurApi("ACCES_REFUSE");
    const [fiche] = await this.db
      .update(clientsAgence)
      .set(c)
      .where(and(eq(clientsAgence.agenceId, a.agenceId), eq(clientsAgence.utilisateurId, id)))
      .returning();
    if (!fiche) throw introuvable();
    if (c.listeNoire !== undefined)
      await this.journal.noter({
        action: "client.liste_noire",
        entite: "utilisateur",
        entiteId: id,
        agenceId: a.agenceId,
        utilisateurId: moi.id,
        details: { listeNoire: c.listeNoire },
      });
    return fiche;
  }

  /**
   * Documents d'identité d'un client — visibles seulement par une agence concernée par une
   * réservation de ce client (section 11), via URL signée courte ; chaque accès est journalisé.
   */
  @RouteAgence()
  @Get("agence/reservations/:id/documents-client")
  async documentsClient(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    const [r] = await this.db
      .select({ clientId: reservations.clientId })
      .from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.agenceId, a.agenceId)));
    if (!r?.clientId) throw introuvable();
    const docs = await this.db
      .select()
      .from(documentsIdentite)
      .where(eq(documentsIdentite.utilisateurId, r.clientId));
    await this.journal.noter({
      action: "document.consulter",
      entite: "reservation",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { client: r.clientId, documents: docs.length },
    });
    return Promise.all(
      docs.map(async (d) => ({
        id: d.id,
        type: d.type,
        numero: d.numero,
        dateDelivrance: d.dateDelivrance,
        dateExpiration: d.dateExpiration,
        statutVerification: d.statutVerification,
        urls: {
          recto: d.fichiers.recto ? await this.stockage.urlLecture(d.fichiers.recto) : null,
          verso: d.fichiers.verso ? await this.stockage.urlLecture(d.fichiers.verso) : null,
        },
      })),
    );
  }

  @RouteAgence()
  @Permission("gerant")
  @Delete("agence/points-retrait/:id")
  @HttpCode(204)
  async desactiverPoint(@MonAgence() a: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    const r = await this.db
      .update(pointsRetrait)
      .set({ actif: false })
      .where(and(eq(pointsRetrait.id, id), eq(pointsRetrait.agenceId, a.agenceId)))
      .returning();
    if (!r.length) throw introuvable();
  }
}
