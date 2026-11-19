import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { agences, avis, messages, reservations, utilisateurs, vehicules } from "@lvb/db";
import { avisPossible, noteMoyenne, schemas } from "@lvb/shared";
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { Admin, MonAgence, Moi, Public, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";
import { Diffusion } from "../temps-reel/diffusion.js";

/** Nom affiché publiquement : prénom et initiale du nom (vie privée). */
const nomPublic = (prenom: string | null, nom: string | null) =>
  [prenom, nom ? `${nom[0]}.` : null].filter(Boolean).join(" ") || null;

/** Avis clients (règle 6.3.9) et messagerie client ↔ agence (3.5). */
@ApiTags("Avis et messagerie")
@ApiBearerAuth()
@Controller()
export class AvisMessagesController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly diffusion: Diffusion,
    private readonly journal: JournalService,
  ) {}

  private async reservationDuClient(id: string, clientId: string) {
    const [r] = await this.db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.clientId, clientId)));
    if (!r) throw introuvable();
    return r;
  }

  private async reservationDeLAgence(id: string, agenceId: string) {
    const [r] = await this.db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.id, id),
          eq(reservations.agenceId, agenceId),
          ne(reservations.origine, "blocage"),
        ),
      );
    if (!r) throw introuvable();
    return r;
  }

  // ---------------------------------------------------------------------------
  // Avis
  // ---------------------------------------------------------------------------

  /** L'avis du client sur sa réservation, et s'il peut encore en donner un. */
  @Get("moi/reservations/:id/avis")
  async monAvis(@Moi() moi: UtilisateurConnecte, @Param("id", ParseUUIDPipe) id: string) {
    const r = await this.reservationDuClient(id, moi.id);
    const [a] = await this.db.select().from(avis).where(eq(avis.reservationId, id));
    return {
      avis: a ?? null,
      possible:
        !a && avisPossible({ statut: r.statut, retourLe: r.retourLe, maintenant: new Date() }),
    };
  }

  @Post("moi/reservations/:id/avis")
  @DocCorps(schemas.avisCreer)
  async donnerAvis(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.avisCreer) c: z.output<typeof schemas.avisCreer>,
  ) {
    const r = await this.reservationDuClient(id, moi.id);
    if (!avisPossible({ statut: r.statut, retourLe: r.retourLe, maintenant: new Date() }))
      throw new ErreurApi("TRANSITION_INTERDITE");
    const [a] = await this.db
      .insert(avis)
      .values({
        agenceId: r.agenceId,
        reservationId: id,
        vehiculeId: r.vehiculeId,
        auteurId: moi.id,
        note: c.note,
        commentaire: c.commentaire || null,
      })
      .onConflictDoNothing()
      .returning();
    if (!a) throw new ErreurApi("CONFLIT");
    return a;
  }

  /** Avis publiés d'une agence, avec la note moyenne (page publique, fiche véhicule). */
  @Public()
  @Get("agences/:id/avis")
  async avisAgence(
    @Param("id", ParseUUIDPipe) id: string,
    @Requete(schemas.pagination) p: z.output<typeof schemas.pagination>,
  ) {
    const filtre = and(eq(avis.agenceId, id), eq(avis.statut, "publie"));
    const lignes = await this.db
      .select({
        a: avis,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        vehicule: sql<string | null>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
      })
      .from(avis)
      .innerJoin(utilisateurs, eq(utilisateurs.id, avis.auteurId))
      .leftJoin(vehicules, eq(vehicules.id, avis.vehiculeId))
      .where(filtre)
      .orderBy(desc(avis.createdAt))
      .limit(p.parPage)
      .offset((p.page - 1) * p.parPage);
    const notes = await this.db.select({ note: avis.note }).from(avis).where(filtre);
    return {
      moyenne: noteMoyenne(notes.map((n) => n.note)),
      nombre: notes.length,
      repartition: [5, 4, 3, 2, 1].map((n) => ({
        note: n,
        nombre: notes.filter((x) => x.note === n).length,
      })),
      avis: lignes.map((l) => ({
        id: l.a.id,
        note: l.a.note,
        commentaire: l.a.commentaire,
        reponseAgence: l.a.reponseAgence,
        createdAt: l.a.createdAt,
        auteur: nomPublic(l.prenom, l.nom),
        vehicule: l.vehicule,
      })),
    };
  }

  @RouteAgence()
  @Get("agence/avis")
  async avisDeMonAgence(@MonAgence() ag: ContexteAgence) {
    return this.db
      .select({
        a: avis,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        code: reservations.code,
      })
      .from(avis)
      .innerJoin(utilisateurs, eq(utilisateurs.id, avis.auteurId))
      .innerJoin(reservations, eq(reservations.id, avis.reservationId))
      .where(eq(avis.agenceId, ag.agenceId))
      .orderBy(desc(avis.createdAt))
      .limit(200)
      .then((l) => l.map((x) => ({ ...x.a, auteur: nomPublic(x.prenom, x.nom), code: x.code })));
  }

  @RouteAgence()
  @Post("agence/avis/:id/reponse")
  @HttpCode(200)
  @DocCorps(schemas.avisReponse)
  async repondre(
    @MonAgence() ag: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.avisReponse) c: z.output<typeof schemas.avisReponse>,
  ) {
    const [a] = await this.db
      .update(avis)
      .set({ reponseAgence: c.reponse, reponduLe: new Date() })
      .where(and(eq(avis.id, id), eq(avis.agenceId, ag.agenceId)))
      .returning();
    if (!a) throw introuvable();
    await this.journal.noter({
      action: "avis.repondre",
      entite: "avis",
      entiteId: id,
      agenceId: ag.agenceId,
      utilisateurId: moi.id,
    });
    return a;
  }

  /** L'agence signale un avis abusif ; l'administrateur décide (section 5). */
  @RouteAgence()
  @Post("agence/avis/:id/signaler")
  @HttpCode(200)
  async signaler(@MonAgence() ag: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    const [a] = await this.db
      .update(avis)
      .set({ signale: true })
      .where(and(eq(avis.id, id), eq(avis.agenceId, ag.agenceId)))
      .returning();
    if (!a) throw introuvable();
    return a;
  }

  @Admin()
  @Get("admin/avis")
  async avisAdmin(
    @Requete(z.object({ signales: z.enum(["true", "false"]).optional() }))
    q: {
      signales?: "true" | "false";
    },
  ) {
    return this.db
      .select({
        a: avis,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        agence: agences.raisonSociale,
      })
      .from(avis)
      .innerJoin(utilisateurs, eq(utilisateurs.id, avis.auteurId))
      .innerJoin(agences, eq(agences.id, avis.agenceId))
      .where(q.signales === "true" ? eq(avis.signale, true) : undefined)
      .orderBy(desc(avis.signale), desc(avis.createdAt))
      .limit(200)
      .then((l) =>
        l.map((x) => ({ ...x.a, auteur: nomPublic(x.prenom, x.nom), agence: x.agence })),
      );
  }

  @Admin()
  @Post("admin/avis/:id/decision")
  @HttpCode(200)
  @DocCorps(schemas.avisDecision)
  async moderer(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.avisDecision) c: z.output<typeof schemas.avisDecision>,
  ) {
    const [a] = await this.db
      .update(avis)
      .set({ statut: c.decision === "masquer" ? "masque" : "publie", signale: false })
      .where(eq(avis.id, id))
      .returning();
    if (!a) throw introuvable();
    await this.journal.noter({
      action: `admin.avis.${c.decision}`,
      entite: "avis",
      entiteId: id,
      utilisateurId: moi.id,
    });
    return a;
  }

  // ---------------------------------------------------------------------------
  // Messagerie
  // ---------------------------------------------------------------------------

  private async fil(reservationId: string, lecteur: "client" | "agence") {
    // Les messages de l'autre partie sont marqués lus à l'ouverture du fil.
    await this.db
      .update(messages)
      .set({ luLe: new Date() })
      .where(
        and(
          eq(messages.reservationId, reservationId),
          ne(messages.auteur, lecteur),
          isNull(messages.luLe),
        ),
      );
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.reservationId, reservationId))
      .orderBy(asc(messages.createdAt))
      .limit(500);
  }

  private async envoyer(
    r: typeof reservations.$inferSelect,
    auteurId: string,
    auteur: "client" | "agence",
    texte: string,
  ) {
    const [m] = await this.db
      .insert(messages)
      .values({ agenceId: r.agenceId, reservationId: r.id, auteurId, auteur, texte })
      .returning();
    this.diffusion.versAgence(r.agenceId, "message.nouveau", { ...m, code: r.code });
    if (r.clientId)
      this.diffusion.versUtilisateur(r.clientId, "message.nouveau", { ...m, code: r.code });
    return m;
  }

  @Get("moi/reservations/:id/messages")
  async messagesClient(@Moi() moi: UtilisateurConnecte, @Param("id", ParseUUIDPipe) id: string) {
    await this.reservationDuClient(id, moi.id);
    return this.fil(id, "client");
  }

  @Post("moi/reservations/:id/messages")
  @DocCorps(schemas.messageEnvoyer)
  async ecrireClient(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.messageEnvoyer) c: z.output<typeof schemas.messageEnvoyer>,
  ) {
    return this.envoyer(await this.reservationDuClient(id, moi.id), moi.id, "client", c.texte);
  }

  @RouteAgence()
  @Get("agence/reservations/:id/messages")
  async messagesAgence(@MonAgence() ag: ContexteAgence, @Param("id", ParseUUIDPipe) id: string) {
    await this.reservationDeLAgence(id, ag.agenceId);
    return this.fil(id, "agence");
  }

  @RouteAgence()
  @Post("agence/reservations/:id/messages")
  @DocCorps(schemas.messageEnvoyer)
  async ecrireAgence(
    @MonAgence() ag: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.messageEnvoyer) c: z.output<typeof schemas.messageEnvoyer>,
  ) {
    return this.envoyer(
      await this.reservationDeLAgence(id, ag.agenceId),
      moi.id,
      "agence",
      c.texte,
    );
  }

  /**
   * Boîte de réception de l'agence : une conversation par réservation, triées par dernier message,
   * avec le client, la réservation et le nombre de messages non lus.
   */
  @RouteAgence()
  @Get("agence/conversations")
  async conversations(@MonAgence() ag: ContexteAgence) {
    const lignes = (await this.db.execute(sql`
      SELECT r.id AS "reservationId", r.code, r.statut, r.debut, r.fin,
             v.marque || ' ' || v.modele AS vehicule,
             u.id AS "clientId", u.prenom, u.nom, u.telephone,
             dernier.texte AS "dernierTexte", dernier.auteur AS "dernierAuteur", dernier.created_at AS "dernierLe",
             (SELECT count(*)::int FROM messages m2
               WHERE m2.reservation_id = r.id AND m2.auteur = 'client' AND m2.lu_le IS NULL) AS "nonLus"
      FROM reservations r
      JOIN vehicules v ON v.id = r.vehicule_id
      JOIN utilisateurs u ON u.id = r.client_id
      JOIN LATERAL (
        SELECT texte, auteur, created_at FROM messages m
        WHERE m.reservation_id = r.id ORDER BY created_at DESC LIMIT 1
      ) dernier ON true
      WHERE r.agence_id = ${ag.agenceId}
      ORDER BY dernier.created_at DESC
      LIMIT 200`)) as unknown as Record<string, unknown>[];
    return lignes;
  }

  /** Nombre de messages clients non lus, par réservation (badge du logiciel). */
  @RouteAgence()
  @Get("agence/messages/non-lus")
  async nonLus(@MonAgence() ag: ContexteAgence) {
    return this.db
      .select({ reservationId: messages.reservationId, n: sql<number>`count(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.agenceId, ag.agenceId),
          eq(messages.auteur, "client"),
          isNull(messages.luLe),
        ),
      )
      .groupBy(messages.reservationId);
  }
}
