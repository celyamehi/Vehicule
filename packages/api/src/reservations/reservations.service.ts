import { Injectable } from "@nestjs/common";
import {
  agences,
  categoriesVehicule,
  clientsAgence,
  entreprises,
  documentsIdentite,
  etatsDesLieux,
  estViolationChevauchement,
  infosErreurPg,
  pointsRetrait,
  reservations,
  tarifs,
  utilisateurs,
  vehicules,
  type ConditionsFigees,
} from "@lvb/db";
import {
  ErreurTarif,
  PENALITE_ANNULATION_AGENCE,
  type StatutReservation,
  TRANSITIONS,
  calculerFraisRetour,
  calculerPrix,
  calculerRemboursement,
  echeanceExpiration,
  genererCodeReservation,
  joursFactures,
  nomWilaya,
  schemas,
  statutInitial,
  verifierConditionsConducteur,
  type DetailPrix,
  type OptionReservable,
  type TarifPourCalcul,
} from "@lvb/shared";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { Diffusion } from "../temps-reel/diffusion.js";

type Reservation = typeof reservations.$inferSelect;
type Vehicule = typeof vehicules.$inferSelect;
type Agence = typeof agences.$inferSelect;
type Tx = Parameters<Parameters<Base["transaction"]>[0]>[0];

/** Préfixe du code de réservation : 3 premières lettres de la wilaya (BÉJ → BEJ, ALG…). */
function prefixeWilaya(wilaya: number) {
  return nomWilaya(wilaya, "fr")
    .normalize("NFD")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

/** Représentation renvoyée par l'API (sans la colonne technique `periode`). */
export function versDto(r: Reservation) {
  const { periode: _periode, ...reste } = r;
  return reste;
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly diffusion: Diffusion,
    private readonly notifications: NotificationsService,
    private readonly journal: JournalService,
  ) {}

  // -------------------------------------------------------------------------
  // Lecture
  // -------------------------------------------------------------------------

  async tarifsPour(
    vehicule: Pick<Vehicule, "id" | "agenceId" | "categorieId">,
    executeur: Base | Tx = this.db,
  ) {
    const lignes = await executeur
      .select()
      .from(tarifs)
      .where(
        and(
          eq(tarifs.agenceId, vehicule.agenceId),
          eq(tarifs.actif, true),
          or(eq(tarifs.vehiculeId, vehicule.id), eq(tarifs.categorieId, vehicule.categorieId)),
        ),
      );
    return lignes.map((t): TarifPourCalcul => ({
      id: t.id,
      vehiculeId: t.vehiculeId,
      categorieId: t.categorieId,
      prixJour: t.prixJour,
      paliers: t.paliers,
      supplements: t.supplements,
      saisonDebut: t.saisonDebut,
      saisonFin: t.saisonFin,
      caution: t.caution,
      actif: t.actif,
    }));
  }

  /** Calcule le prix en traduisant les erreurs de tarif en erreurs API. */
  calculer(params: Parameters<typeof calculerPrix>[0]): DetailPrix {
    try {
      return calculerPrix(params);
    } catch (e) {
      if (e instanceof ErreurTarif) throw new ErreurApi(e.code, e.details);
      if (e instanceof RangeError) throw new ErreurApi("DATES_INVALIDES");
      throw e;
    }
  }

  /** Vrai si le véhicule est libre sur [debut, fin + battement) (même règle que la contrainte SQL). */
  async estDisponible(
    vehiculeId: string,
    debut: Date,
    fin: Date,
    battementMinutes: number,
    sauf?: string,
  ) {
    const [conflit] = await this.db
      .select({ id: reservations.id })
      .from(reservations)
      .where(
        and(
          eq(reservations.vehiculeId, vehiculeId),
          inArray(reservations.statut, [
            "en_attente_paiement",
            "en_attente_agence",
            "confirmee",
            "en_cours",
          ]),
          sql`${reservations.periode} && tstzrange(${debut.toISOString()}::timestamptz, ${new Date(fin.getTime() + battementMinutes * 60_000).toISOString()}::timestamptz, '[)')`,
          sauf ? sql`${reservations.id} <> ${sauf}` : undefined,
        ),
      )
      .limit(1);
    return !conflit;
  }

  private async charger(id: string, filtre: { agenceId?: string; clientId?: string } = {}) {
    const [r] = await this.db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.id, id),
          filtre.agenceId ? eq(reservations.agenceId, filtre.agenceId) : undefined,
          filtre.clientId ? eq(reservations.clientId, filtre.clientId) : undefined,
        ),
      );
    if (!r) throw introuvable();
    return r;
  }

  /** Détail complet d'une réservation (véhicule, agence, client, états des lieux). */
  async detail(id: string, filtre: { agenceId?: string; clientId?: string }) {
    const r = await this.charger(id, filtre);
    const [vehicule] = await this.db
      .select({
        id: vehicules.id,
        marque: vehicules.marque,
        modele: vehicules.modele,
        annee: vehicules.annee,
        immatriculation: vehicules.immatriculation,
        categorie: categoriesVehicule.code,
        boite: vehicules.boite,
        carburant: vehicules.carburant,
        places: vehicules.places,
        kmInclusParJour: vehicules.kmInclusParJour,
      })
      .from(vehicules)
      .innerJoin(categoriesVehicule, eq(categoriesVehicule.id, vehicules.categorieId))
      .where(eq(vehicules.id, r.vehiculeId));
    const [agence] = await this.db
      .select({
        id: agences.id,
        raisonSociale: agences.raisonSociale,
        telephone: agences.telephone,
        adresse: agences.adresse,
        wilaya: agences.wilaya,
      })
      .from(agences)
      .where(eq(agences.id, r.agenceId));
    const client = r.clientId
      ? (
          await this.db
            .select({
              id: utilisateurs.id,
              nom: utilisateurs.nom,
              prenom: utilisateurs.prenom,
              telephone: utilisateurs.telephone,
              dateNaissance: utilisateurs.dateNaissance,
            })
            .from(utilisateurs)
            .where(eq(utilisateurs.id, r.clientId))
        )[0]
      : null;
    const points = await this.db
      .select({ id: pointsRetrait.id, nom: pointsRetrait.nom, adresse: pointsRetrait.adresse })
      .from(pointsRetrait)
      .where(eq(pointsRetrait.agenceId, r.agenceId));
    const edl = await this.db
      .select()
      .from(etatsDesLieux)
      .where(eq(etatsDesLieux.reservationId, r.id));
    return {
      ...versDto(r),
      vehicule,
      agence,
      client,
      pointDepart: points.find((p) => p.id === r.pointRetraitDepartId) ?? null,
      pointRetour: points.find((p) => p.id === r.pointRetraitRetourId) ?? null,
      etatsDesLieux: edl,
    };
  }

  // -------------------------------------------------------------------------
  // Création
  // -------------------------------------------------------------------------

  /**
   * Insère une réservation. La contrainte d'exclusion PostgreSQL tranche les conflits,
   * y compris entre deux requêtes simultanées : l'une passe, l'autre reçoit VEHICULE_INDISPONIBLE.
   */
  private async inserer(
    valeurs: Omit<typeof reservations.$inferInsert, "code">,
    wilaya: number,
    tx?: Tx,
  ) {
    const executeur = tx ?? this.db;
    for (let essai = 0; essai < 5; essai++) {
      try {
        const [r] = await executeur
          .insert(reservations)
          .values({ ...valeurs, code: genererCodeReservation(prefixeWilaya(wilaya)) })
          .returning();
        return r!;
      } catch (e) {
        if (estViolationChevauchement(e)) throw new ErreurApi("VEHICULE_INDISPONIBLE");
        // Collision de code (rarissime) : on réessaie avec un autre code.
        if (infosErreurPg(e)?.contrainte === "reservations_code_uq") continue;
        throw e;
      }
    }
    throw new ErreurApi("CONFLIT");
  }

  private conditionsFigees(agence: Agence, vehicule: Vehicule): ConditionsFigees {
    return {
      ageMinimum: agence.ageMinimum,
      ancienneteMinPermisAnnees: agence.ancienneteMinPermisAnnees,
      kmInclusParJour: vehicule.kmInclusParJour,
      politiqueAnnulation: agence.politiqueAnnulation,
    };
  }

  private async vehiculeEtAgence(vehiculeId: string) {
    const [ligne] = await this.db
      .select({ vehicule: vehicules, agence: agences })
      .from(vehicules)
      .innerJoin(agences, eq(agences.id, vehicules.agenceId))
      .where(eq(vehicules.id, vehiculeId));
    if (!ligne) throw introuvable();
    return ligne;
  }

  private async verifierListeNoire(agenceId: string, clientId: string) {
    const [fiche] = await this.db
      .select({ listeNoire: clientsAgence.listeNoire })
      .from(clientsAgence)
      .where(and(eq(clientsAgence.agenceId, agenceId), eq(clientsAgence.utilisateurId, clientId)));
    if (fiche?.listeNoire) throw new ErreurApi("CLIENT_LISTE_NOIRE");
  }

  /** Réservation en ligne par un client (section 3.4, paiement sur place en Phase 1). */
  async creerParClient(clientId: string, entree: z.output<typeof schemas.reservationClientCreer>) {
    const { vehicule, agence } = await this.vehiculeEtAgence(entree.vehiculeId);
    if (agence.statut !== "validee" || !vehicule.visiblePlateforme) throw introuvable();
    if (vehicule.statut === "hors_service" || vehicule.statut === "en_entretien")
      throw new ErreurApi("VEHICULE_INDISPONIBLE");
    if (entree.debut.getTime() < Date.now() - 5 * 60_000) throw new ErreurApi("DATES_INVALIDES");
    await this.verifierListeNoire(agence.id, clientId);

    // Conditions conducteur vérifiées avant toute confirmation (règle 6.3.7).
    const [client] = await this.db.select().from(utilisateurs).where(eq(utilisateurs.id, clientId));
    const [permis] = await this.db
      .select()
      .from(documentsIdentite)
      .where(
        and(eq(documentsIdentite.utilisateurId, clientId), eq(documentsIdentite.type, "permis")),
      )
      .orderBy(desc(documentsIdentite.createdAt))
      .limit(1);
    const problemes = verifierConditionsConducteur({
      dateNaissance: client?.dateNaissance,
      permis: permis
        ? { dateDelivrance: permis.dateDelivrance, dateExpiration: permis.dateExpiration }
        : null,
      depart: entree.debut,
      fin: entree.fin,
      ageMinimum: agence.ageMinimum,
      ancienneteMinPermisAnnees: agence.ancienneteMinPermisAnnees,
    });
    if (problemes.length)
      throw new ErreurApi("CONDITIONS_CONDUCTEUR", {
        problemes,
        ageMinimum: agence.ageMinimum,
        ancienneteMinPermisAnnees: agence.ancienneteMinPermisAnnees,
      });

    // Prix figé dès la création (règle 6.3.6) : un changement de tarif ultérieur ne le modifie pas.
    const detailPrix = this.calculer({
      debut: entree.debut,
      fin: entree.fin,
      tarifs: await this.tarifsPour(vehicule),
      options: entree.options,
      livraison: entree.livraison,
    });
    const maintenant = new Date();
    const statut = statutInitial({
      origine: "plateforme",
      paiementEnLigne: false,
      confirmationInstantanee: agence.confirmationInstantanee,
    });
    const r = await this.inserer(
      {
        agenceId: agence.id,
        vehiculeId: vehicule.id,
        clientId,
        pointRetraitDepartId: entree.pointRetraitDepartId ?? vehicule.pointRetraitId,
        pointRetraitRetourId:
          entree.pointRetraitRetourId ?? entree.pointRetraitDepartId ?? vehicule.pointRetraitId,
        debut: entree.debut,
        fin: entree.fin,
        battementMinutes: agence.battementMinutes,
        origine: "plateforme",
        statut,
        prixTotal: detailPrix.total,
        detailPrix,
        politiqueAnnulation: agence.politiqueAnnulation,
        caution: detailPrix.caution,
        conditions: this.conditionsFigees(agence, vehicule),
        optionsChoisies: entree.options,
        livraison:
          entree.livraison && entree.adresseLivraison
            ? {
                adresse: entree.adresseLivraison.adresse,
                commune: entree.adresseLivraison.commune,
                recuperation: entree.adresseLivraison.recuperation,
                ...(entree.adresseLivraison.instructions
                  ? { instructions: entree.adresseLivraison.instructions }
                  : {}),
              }
            : null,
        expireLe: echeanceExpiration(statut, maintenant),
        confirmeeLe: statut === "confirmee" ? maintenant : null,
        creePar: clientId,
      },
      agence.wilaya,
    );
    await this.db
      .insert(clientsAgence)
      .values({ agenceId: agence.id, utilisateurId: clientId })
      .onConflictDoNothing();

    this.diffusion.versAgence(agence.id, "reservation.creee", versDto(r));
    this.diffusion.versUtilisateur(clientId, "reservation.creee", versDto(r));
    this.diffusion.versAgence(agence.id, "vehicule.disponibilite_change", {
      vehiculeId: vehicule.id,
    });
    await this.notifications.notifier(
      clientId,
      statut === "confirmee" ? "reservation_confirmee" : "reservation_creee",
      { code: r.code },
      statut === "confirmee"
        ? {
            cle: "reservationConfirmee",
            valeurs: {
              code: r.code,
              vehicule: `${vehicule.marque} ${vehicule.modele}`,
              date: r.debut.toISOString().slice(0, 10),
              agence: agence.raisonSociale,
              telephone: agence.telephone,
            },
          }
        : { cle: "reservationRecue", valeurs: { code: r.code } },
    );
    await this.notifications.notifierAgence(agence.id, {
      code: r.code,
      vehicule: `${vehicule.marque} ${vehicule.modele}`,
      date: r.debut.toISOString().slice(0, 10),
    });
    return versDto(r);
  }

  /** Réservation créée au comptoir ou par téléphone : directement confirmée ou en cours (6.2). */
  async creerParAgence(
    agenceId: string,
    auteurId: string,
    entree: z.output<typeof schemas.reservationComptoirCreer>,
  ) {
    const { vehicule, agence } = await this.vehiculeEtAgence(entree.vehiculeId);
    if (agence.id !== agenceId) throw introuvable();

    const clientId =
      "id" in entree.client ? entree.client.id : await this.trouverOuCreerClient(entree.client);
    if ("id" in entree.client) {
      const [existe] = await this.db
        .select({ id: utilisateurs.id })
        .from(utilisateurs)
        .where(eq(utilisateurs.id, clientId));
      if (!existe) throw introuvable({ client: clientId });
    }
    await this.verifierListeNoire(agenceId, clientId);
    if (entree.entrepriseId) {
      // L'entreprise facturée doit appartenir à l'agence et ne pas être sur liste noire.
      const [e] = await this.db
        .select({ listeNoire: entreprises.listeNoire })
        .from(entreprises)
        .where(and(eq(entreprises.id, entree.entrepriseId), eq(entreprises.agenceId, agenceId)));
      if (!e) throw introuvable({ entreprise: entree.entrepriseId });
      if (e.listeNoire) throw new ErreurApi("CLIENT_LISTE_NOIRE");
    }

    const detailPrix = this.calculer({
      debut: entree.debut,
      fin: entree.fin,
      tarifs: await this.tarifsPour(vehicule),
      options: entree.options,
      livraison: entree.livraison,
      ...(entree.remise !== undefined ? { remise: entree.remise } : {}),
    });
    if (entree.prixTotal !== undefined) detailPrix.total = entree.prixTotal;

    const statut = statutInitial({
      origine: entree.origine,
      paiementEnLigne: false,
      confirmationInstantanee: true,
      departImmediat: entree.departImmediat,
    });
    const maintenant = new Date();
    const r = await this.inserer(
      {
        agenceId,
        vehiculeId: vehicule.id,
        clientId,
        pointRetraitDepartId: vehicule.pointRetraitId,
        pointRetraitRetourId: vehicule.pointRetraitId,
        debut: entree.debut,
        fin: entree.fin,
        battementMinutes: agence.battementMinutes,
        origine: entree.origine,
        statut,
        prixTotal: detailPrix.total,
        detailPrix,
        politiqueAnnulation: agence.politiqueAnnulation,
        caution: detailPrix.caution,
        conditions: this.conditionsFigees(agence, vehicule),
        optionsChoisies: entree.options,
        confirmeeLe: maintenant,
        departLe: statut === "en_cours" ? maintenant : null,
        noteInterne: entree.noteInterne ?? null,
        entrepriseId: entree.entrepriseId ?? null,
        creePar: auteurId,
      },
      agence.wilaya,
    );
    if (statut === "en_cours")
      await this.db.update(vehicules).set({ statut: "loue" }).where(eq(vehicules.id, vehicule.id));
    await this.db
      .insert(clientsAgence)
      .values({ agenceId, utilisateurId: clientId })
      .onConflictDoNothing();
    await this.journal.noter({
      action: "reservation.creer",
      entite: "reservation",
      entiteId: r.id,
      agenceId,
      utilisateurId: auteurId,
      details: {
        origine: entree.origine,
        prixTotal: r.prixTotal,
        prixForce: entree.prixTotal !== undefined,
      },
    });
    this.diffusion.versAgence(agenceId, "reservation.creee", versDto(r));
    this.diffusion.versAgence(agenceId, "vehicule.disponibilite_change", {
      vehiculeId: vehicule.id,
    });
    return versDto(r);
  }

  private async trouverOuCreerClient(
    c: Exclude<z.output<typeof schemas.reservationComptoirCreer>["client"], { id: string }>,
  ) {
    const [u] = await this.db
      .insert(utilisateurs)
      .values({
        telephone: c.telephone,
        nom: c.nom,
        prenom: c.prenom,
        dateNaissance: c.dateNaissance ?? null,
      })
      .onConflictDoUpdate({
        target: utilisateurs.telephone,
        // On complète sans écraser ce que le client a renseigné lui-même.
        set: {
          nom: sql`coalesce(${utilisateurs.nom}, excluded.nom)`,
          prenom: sql`coalesce(${utilisateurs.prenom}, excluded.prenom)`,
          dateNaissance: sql`coalesce(${utilisateurs.dateNaissance}, excluded.date_naissance)`,
        },
      })
      .returning();
    if (c.permis) {
      await this.db.insert(documentsIdentite).values({
        utilisateurId: u!.id,
        type: "permis",
        numero: c.permis.numero,
        dateDelivrance: c.permis.dateDelivrance,
        dateExpiration: c.permis.dateExpiration ?? null,
      });
    }
    return u!.id;
  }

  /** Blocage manuel d'une période (entretien, usage personnel — section 4.4, décision D12). */
  async bloquer(agenceId: string, auteurId: string, entree: z.output<typeof schemas.blocageCreer>) {
    const { vehicule, agence } = await this.vehiculeEtAgence(entree.vehiculeId);
    if (agence.id !== agenceId) throw introuvable();
    const r = await this.inserer(
      {
        agenceId,
        vehiculeId: vehicule.id,
        clientId: null,
        debut: entree.debut,
        fin: entree.fin,
        battementMinutes: 0,
        origine: "blocage",
        statut: "confirmee",
        prixTotal: 0,
        politiqueAnnulation: agence.politiqueAnnulation,
        motifBlocage: entree.motif,
        creePar: auteurId,
      },
      agence.wilaya,
    );
    this.diffusion.versAgence(agenceId, "reservation.creee", versDto(r));
    return versDto(r);
  }

  async debloquer(agenceId: string, id: string) {
    const supprimees = await this.db
      .delete(reservations)
      .where(
        and(
          eq(reservations.id, id),
          eq(reservations.agenceId, agenceId),
          eq(reservations.origine, "blocage"),
        ),
      )
      .returning();
    if (!supprimees.length) throw introuvable();
    this.diffusion.versAgence(agenceId, "reservation.statut_change", { id, statut: "supprimee" });
  }

  // -------------------------------------------------------------------------
  // Changements de statut (atomiques)
  // -------------------------------------------------------------------------

  /**
   * Passe une réservation à `vers` seulement si son statut actuel l'autorise (tableau 6.2).
   * L'UPDATE conditionnel évite toute course entre deux actions simultanées.
   */
  private async transitionner(
    id: string,
    filtre: { agenceId?: string; clientId?: string },
    vers: StatutReservation,
    champs: Partial<typeof reservations.$inferInsert> = {},
    conditionSupplementaire?: ReturnType<typeof sql>,
  ) {
    const depuis = (Object.keys(TRANSITIONS) as StatutReservation[]).filter((s) =>
      TRANSITIONS[s].includes(vers),
    );
    const [r] = await this.db
      .update(reservations)
      .set({ ...champs, statut: vers })
      .where(
        and(
          eq(reservations.id, id),
          filtre.agenceId ? eq(reservations.agenceId, filtre.agenceId) : undefined,
          filtre.clientId ? eq(reservations.clientId, filtre.clientId) : undefined,
          inArray(reservations.statut, depuis),
          sql`${reservations.origine} <> 'blocage'`,
          conditionSupplementaire,
        ),
      )
      .returning();
    if (!r) {
      await this.charger(id, filtre); // INTROUVABLE si la réservation n'est pas visible
      throw new ErreurApi("TRANSITION_INTERDITE");
    }
    this.diffusion.versAgence(r.agenceId, "reservation.statut_change", versDto(r));
    if (r.clientId)
      this.diffusion.versUtilisateur(r.clientId, "reservation.statut_change", versDto(r));
    if (!["en_cours", "confirmee"].includes(vers))
      this.diffusion.versAgence(r.agenceId, "vehicule.disponibilite_change", {
        vehiculeId: r.vehiculeId,
      });
    return r;
  }

  async accepter(agenceId: string, id: string, auteurId: string) {
    const r = await this.transitionner(
      id,
      { agenceId },
      "confirmee",
      { confirmeeLe: new Date(), expireLe: null },
      sql`(${reservations.expireLe} IS NULL OR ${reservations.expireLe} > now())`,
    );
    const [ligne] = await this.db
      .select({ v: vehicules, a: agences })
      .from(vehicules)
      .innerJoin(agences, eq(agences.id, vehicules.agenceId))
      .where(eq(vehicules.id, r.vehiculeId));
    await this.journal.noter({
      action: "reservation.accepter",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
    });
    if (r.clientId && ligne)
      await this.notifications.notifier(
        r.clientId,
        "reservation_confirmee",
        { code: r.code },
        {
          cle: "reservationConfirmee",
          valeurs: {
            code: r.code,
            vehicule: `${ligne.v.marque} ${ligne.v.modele}`,
            date: r.debut.toISOString().slice(0, 10),
            agence: ligne.a.raisonSociale,
            telephone: ligne.a.telephone,
          },
        },
      );
    return versDto(r);
  }

  async refuser(agenceId: string, id: string, auteurId: string, motif: string) {
    const r = await this.transitionner(id, { agenceId }, "refusee", {
      motifRefus: motif,
      expireLe: null,
    });
    await this.journal.noter({
      action: "reservation.refuser",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
      details: { motif },
    });
    if (r.clientId)
      await this.notifications.notifier(
        r.clientId,
        "reservation_refusee",
        { code: r.code },
        {
          cle: "reservationRefusee",
          valeurs: { code: r.code },
        },
      );
    return versDto(r);
  }

  /** Annulation par le client : remboursement selon la politique figée (6.3.4). */
  async annulerParClient(clientId: string, id: string, motif?: string) {
    const avant = await this.charger(id, { clientId });
    const maintenant = new Date();
    const r = await this.transitionner(id, { clientId }, "annulee_client", {
      annuleeLe: maintenant,
      expireLe: null,
      noteInterne: motif ? `Motif client : ${motif}` : avant.noteInterne,
    });
    const remboursement = calculerRemboursement({
      politique: r.politiqueAnnulation,
      montantPaye: 0, // Phase 1 : paiement sur place, rien n'a été encaissé en ligne.
      debut: r.debut,
      annuleLe: maintenant,
      par: "client",
    });
    await this.journal.noter({
      action: "reservation.annuler_client",
      entite: "reservation",
      entiteId: id,
      agenceId: r.agenceId,
      utilisateurId: clientId,
      details: { remboursement },
    });
    return { ...versDto(r), remboursement };
  }

  /** Annulation par l'agence d'une réservation confirmée : remboursement intégral et pénalité (6.3.5). */
  async annulerParAgence(agenceId: string, id: string, auteurId: string, motif?: string) {
    const r = await this.transitionner(id, { agenceId }, "annulee_agence", {
      annuleeLe: new Date(),
      motifRefus: motif ?? null,
    });
    await this.db
      .update(agences)
      .set({ score: sql`greatest(0, ${agences.score} - ${PENALITE_ANNULATION_AGENCE})` })
      .where(eq(agences.id, agenceId));
    await this.journal.noter({
      action: "reservation.annuler_agence",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
      details: { motif, remboursement: "integral" },
    });
    if (r.clientId)
      await this.notifications.notifier(r.clientId, "reservation_annulee", { code: r.code });
    return versDto(r);
  }

  async nonPresentation(agenceId: string, id: string, auteurId: string) {
    const r = await this.transitionner(
      id,
      { agenceId },
      "non_presentation",
      {},
      sql`${reservations.debut} <= now()`,
    );
    await this.journal.noter({
      action: "reservation.non_presentation",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
    });
    return versDto(r);
  }

  /** Remise du véhicule : l'état des lieux de départ doit exister. */
  async depart(agenceId: string, id: string, auteurId: string) {
    const r = await this.charger(id, { agenceId });
    const [edl] = await this.db
      .select({ id: etatsDesLieux.id, kilometrage: etatsDesLieux.kilometrage })
      .from(etatsDesLieux)
      .where(and(eq(etatsDesLieux.reservationId, r.id), eq(etatsDesLieux.moment, "depart")));
    if (!edl) throw new ErreurApi("ETAT_DES_LIEUX_MANQUANT", { moment: "depart" });
    const maj = await this.transitionner(id, { agenceId }, "en_cours", { departLe: new Date() });
    await this.db
      .update(vehicules)
      .set({
        statut: "loue",
        kilometrage: sql`greatest(${vehicules.kilometrage}, ${edl.kilometrage})`,
      })
      .where(eq(vehicules.id, r.vehiculeId));
    await this.journal.noter({
      action: "reservation.depart",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
    });
    return versDto(maj);
  }

  /** Retour du véhicule : comparaison départ / retour et calcul des frais (4.6). */
  async retour(
    agenceId: string,
    id: string,
    auteurId: string,
    entree: z.output<typeof schemas.retourVehicule>,
  ) {
    const r = await this.charger(id, { agenceId });
    const edl = await this.db
      .select()
      .from(etatsDesLieux)
      .where(eq(etatsDesLieux.reservationId, r.id));
    const depart = edl.find((e) => e.moment === "depart");
    const retour = edl.find((e) => e.moment === "retour");
    if (!depart || !retour)
      throw new ErreurApi("ETAT_DES_LIEUX_MANQUANT", { moment: depart ? "retour" : "depart" });
    const [agence] = await this.db.select().from(agences).where(eq(agences.id, agenceId));
    const maintenant = new Date();
    const frais = calculerFraisRetour({
      depart,
      retour,
      debut: r.debut,
      finPrevue: r.fin,
      retourReel: maintenant,
      kmInclusParJour: r.conditions?.kmInclusParJour ?? null,
      prixJourApplique:
        r.detailPrix?.prixJourApplique ?? Math.round(r.prixTotal / joursFactures(r.debut, r.fin)),
      prixKmSupplementaire: agence!.prixKmSupplementaire,
      prixHuitiemeCarburant: agence!.prixHuitiemeCarburant,
      montantDommages: entree.fraisDommages,
    });
    const maj = await this.transitionner(id, { agenceId }, "terminee", {
      retourLe: maintenant,
      fraisRetour: frais,
    });
    await this.db
      .update(vehicules)
      .set({
        statut: "disponible",
        kilometrage: sql`greatest(${vehicules.kilometrage}, ${retour.kilometrage})`,
      })
      .where(eq(vehicules.id, r.vehiculeId));
    await this.journal.noter({
      action: "reservation.retour",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
      details: { frais },
    });
    return versDto(maj);
  }

  // -------------------------------------------------------------------------
  // Modifications
  // -------------------------------------------------------------------------

  private async deplacer(
    r: Reservation,
    changements: { debut?: Date; fin?: Date; vehiculeId?: string },
    detailPrix: DetailPrix,
  ) {
    try {
      const [maj] = await this.db
        .update(reservations)
        .set({
          ...changements,
          detailPrix,
          prixTotal: detailPrix.total,
          caution: detailPrix.caution,
        })
        .where(eq(reservations.id, r.id))
        .returning();
      this.diffusion.versAgence(r.agenceId, "reservation.modifiee", versDto(maj!));
      if (r.clientId)
        this.diffusion.versUtilisateur(r.clientId, "reservation.modifiee", versDto(maj!));
      this.diffusion.versAgence(r.agenceId, "vehicule.disponibilite_change", {
        vehiculeId: maj!.vehiculeId,
      });
      return maj!;
    } catch (e) {
      if (estViolationChevauchement(e)) throw new ErreurApi("VEHICULE_INDISPONIBLE");
      throw e;
    }
  }

  /** Modification des dates par le client (3.5), soumise à disponibilité ; le prix est recalculé. */
  async modifierDates(
    clientId: string,
    id: string,
    entree: z.output<typeof schemas.reservationDatesModifier>,
  ) {
    const r = await this.charger(id, { clientId });
    if (!["en_attente_agence", "confirmee"].includes(r.statut))
      throw new ErreurApi("TRANSITION_INTERDITE");
    if (entree.debut.getTime() < Date.now()) throw new ErreurApi("DATES_INVALIDES");
    const [vehicule] = await this.db.select().from(vehicules).where(eq(vehicules.id, r.vehiculeId));
    const detailPrix = this.calculer({
      debut: entree.debut,
      fin: entree.fin,
      tarifs: await this.tarifsPour(vehicule!),
      options: r.optionsChoisies as OptionReservable[],
      livraison: (r.detailPrix?.fraisLivraison ?? 0) > 0,
    });
    const maj = await this.deplacer(r, { debut: entree.debut, fin: entree.fin }, detailPrix);
    await this.journal.noter({
      action: "reservation.modifier_dates",
      entite: "reservation",
      entiteId: id,
      agenceId: r.agenceId,
      utilisateurId: clientId,
      details: { prixAvant: r.prixTotal, prixApres: maj.prixTotal },
    });
    return versDto(maj);
  }

  /** Prolongation par l'agence : jours supplémentaires au prix journalier figé. */
  async prolonger(agenceId: string, id: string, auteurId: string, fin: Date) {
    const r = await this.charger(id, { agenceId });
    if (!["confirmee", "en_cours"].includes(r.statut) || r.origine === "blocage")
      throw new ErreurApi("TRANSITION_INTERDITE");
    if (fin <= r.debut) throw new ErreurApi("DATES_INVALIDES");
    const ancien = r.detailPrix;
    const jours = joursFactures(r.debut, fin);
    const prixJour =
      ancien?.prixJourApplique ?? Math.round(r.prixTotal / joursFactures(r.debut, r.fin));
    const anciensJours = ancien?.jours ?? joursFactures(r.debut, r.fin);
    // Options : montant par jour réparti proportionnellement à la nouvelle durée.
    const options = (ancien?.options ?? []).map((o) => ({
      ...o,
      montant: Math.round((o.montant * jours) / anciensJours),
    }));
    const sousTotalLocation = prixJour * jours;
    const total =
      sousTotalLocation +
      options.reduce((s, o) => s + o.montant, 0) +
      (ancien?.fraisLivraison ?? 0) -
      (ancien?.remise ?? 0);
    const detailPrix: DetailPrix = {
      jours,
      prixJourApplique: prixJour,
      sousTotalLocation,
      options,
      fraisLivraison: ancien?.fraisLivraison ?? 0,
      remise: ancien?.remise ?? 0,
      total: Math.max(0, total),
      caution: r.caution,
      ...(ancien?.tarifId ? { tarifId: ancien.tarifId } : {}),
    };
    const maj = await this.deplacer(r, { fin }, detailPrix);
    await this.journal.noter({
      action: "reservation.prolonger",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
      details: { finAvant: r.fin, finApres: fin, prixApres: maj.prixTotal },
    });
    return versDto(maj);
  }

  /** Changement de véhicule (même catégorie) — glisser-déposer du planning (4.4). */
  async reaffecter(agenceId: string, id: string, auteurId: string, vehiculeId: string) {
    const r = await this.charger(id, { agenceId });
    if (
      !["en_attente_agence", "confirmee", "en_cours"].includes(r.statut) &&
      r.origine !== "blocage"
    )
      throw new ErreurApi("TRANSITION_INTERDITE");
    const [ancien] = await this.db.select().from(vehicules).where(eq(vehicules.id, r.vehiculeId));
    const [nouveau] = await this.db
      .select()
      .from(vehicules)
      .where(and(eq(vehicules.id, vehiculeId), eq(vehicules.agenceId, agenceId)));
    if (!nouveau) throw introuvable();
    if (r.origine !== "blocage" && nouveau.categorieId !== ancien!.categorieId)
      throw new ErreurApi("CATEGORIE_DIFFERENTE");
    const maj = await this.deplacer(r, { vehiculeId }, r.detailPrix ?? this.detailVide(r));
    if (r.statut === "en_cours") {
      await this.db
        .update(vehicules)
        .set({ statut: "disponible" })
        .where(eq(vehicules.id, ancien!.id));
      await this.db.update(vehicules).set({ statut: "loue" }).where(eq(vehicules.id, nouveau.id));
    }
    await this.journal.noter({
      action: "reservation.reaffecter",
      entite: "reservation",
      entiteId: id,
      agenceId,
      utilisateurId: auteurId,
      details: { de: ancien!.id, vers: vehiculeId },
    });
    return versDto(maj);
  }

  private detailVide(r: Reservation): DetailPrix {
    return {
      jours: 0,
      prixJourApplique: 0,
      sousTotalLocation: 0,
      options: [],
      fraisLivraison: 0,
      remise: 0,
      total: r.prixTotal,
      caution: r.caution,
    };
  }

  // -------------------------------------------------------------------------
  // Expiration (règle 6.3.3)
  // -------------------------------------------------------------------------

  /** Passe en `expiree` les réservations en attente dont l'échéance est dépassée, et libère le véhicule. */
  async expirer(maintenant = new Date()) {
    const expirees = await this.db
      .update(reservations)
      .set({ statut: "expiree" })
      .where(
        and(
          inArray(reservations.statut, ["en_attente_paiement", "en_attente_agence"]),
          lte(reservations.expireLe, maintenant),
        ),
      )
      .returning();
    for (const r of expirees) {
      this.diffusion.versAgence(r.agenceId, "reservation.statut_change", versDto(r));
      this.diffusion.versAgence(r.agenceId, "vehicule.disponibilite_change", {
        vehiculeId: r.vehiculeId,
      });
      if (r.clientId) {
        this.diffusion.versUtilisateur(r.clientId, "reservation.statut_change", versDto(r));
        await this.notifications.notifier(
          r.clientId,
          "reservation_expiree",
          { code: r.code },
          {
            cle: "reservationExpiree",
            valeurs: { code: r.code },
          },
        );
      }
    }
    return expirees.length;
  }

  /** Réservations d'un client, groupées par l'interface (à venir, en cours, passées). */
  async listerPourClient(clientId: string) {
    const lignes = await this.db
      .select({
        r: reservations,
        vehicule: {
          marque: vehicules.marque,
          modele: vehicules.modele,
          categorie: categoriesVehicule.code,
        },
        agence: { raisonSociale: agences.raisonSociale, telephone: agences.telephone },
      })
      .from(reservations)
      .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
      .innerJoin(categoriesVehicule, eq(categoriesVehicule.id, vehicules.categorieId))
      .innerJoin(agences, eq(agences.id, reservations.agenceId))
      .where(and(eq(reservations.clientId, clientId), isNull(reservations.motifBlocage)))
      .orderBy(desc(reservations.debut));
    return lignes.map((l) => ({ ...versDto(l.r), vehicule: l.vehicule, agence: l.agence }));
  }
}
