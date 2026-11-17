import { createHash } from "node:crypto";
import { Controller, Get, Param, ParseUUIDPipe, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  agences,
  categoriesVehicule,
  contrats,
  documentsIdentite,
  etatsDesLieux,
  membresAgence,
  pointsRetrait,
  reservations,
  utilisateurs,
  vehicules,
} from "@lvb/db";
import { dateAlger, schemas } from "@lvb/shared";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Response } from "express";
import { z } from "zod";
import { AdresseIp, MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { Corps, DocCorps } from "../commun/zod.js";
import { Stockage, depuisDataUrl } from "../fichiers/stockage.js";
import { Diffusion } from "../temps-reel/diffusion.js";
import { GenerateurPdf } from "./pdf.js";

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Contrats et états des lieux (4.6) : saisie sur tablette, signature, PDF bilingue. */
@ApiTags("Documents")
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly pdf: GenerateurPdf,
    private readonly stockage: Stockage,
    private readonly journal: JournalService,
    private readonly diffusion: Diffusion,
  ) {}

  /** La réservation est visible par le client concerné, un membre de son agence ou un admin. */
  private async reservationAccessible(id: string, moi: UtilisateurConnecte) {
    const [r] = await this.db.select().from(reservations).where(eq(reservations.id, id));
    if (!r) throw introuvable();
    if (moi.admin || r.clientId === moi.id) return r;
    const [membre] = await this.db
      .select({ id: membresAgence.id })
      .from(membresAgence)
      .where(
        and(
          eq(membresAgence.agenceId, r.agenceId),
          eq(membresAgence.utilisateurId, moi.id),
          eq(membresAgence.actif, true),
        ),
      );
    if (!membre) throw introuvable();
    return r;
  }

  private async deposerSignature(dataUrl: string, reservationId: string, nom: string) {
    let image: ReturnType<typeof depuisDataUrl>;
    try {
      image = depuisDataUrl(dataUrl);
    } catch {
      throw new ErreurApi("FICHIER_INVALIDE");
    }
    const cle = `signatures/${reservationId}/${nom}-${Date.now()}.${image.typeMime === "image/png" ? "png" : "jpg"}`;
    await this.stockage.deposer(cle, image.contenu, image.typeMime);
    return cle;
  }

  private async lireOuNull(cle: string | null | undefined) {
    if (!cle) return null;
    try {
      return await this.stockage.lire(cle);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // États des lieux
  // ---------------------------------------------------------------------------

  @RouteAgence()
  @Permission("etats_des_lieux")
  @Post("agence/reservations/:id/etat-des-lieux")
  @DocCorps(schemas.etatDesLieuxCreer)
  async creerEtatDesLieux(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @AdresseIp() ip: string | null,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.etatDesLieuxCreer) c: z.output<typeof schemas.etatDesLieuxCreer>,
  ) {
    const [r] = await this.db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.agenceId, a.agenceId)));
    if (!r || r.origine === "blocage") throw introuvable();
    const attendu = c.moment === "depart" ? "confirmee" : "en_cours";
    if (r.statut !== attendu) throw new ErreurApi("TRANSITION_INTERDITE");
    for (const p of c.photos)
      if (!p.cle.startsWith(`photo_etat_des_lieux/${moi.id}/`))
        throw new ErreurApi("FICHIER_INVALIDE");

    const signature = await this.deposerSignature(c.signatureClient, id, `edl-${c.moment}`);
    const valeurs = {
      agenceId: a.agenceId,
      reservationId: id,
      moment: c.moment,
      kilometrage: c.kilometrage,
      carburant: c.carburant,
      dommages: c.dommages,
      photos: c.photos,
      observations: c.observations ?? null,
      signePar: moi.id,
      signatureClient: { image: signature, ...(ip ? { ip } : {}) },
      signeLe: new Date(),
    };
    const [edl] = await this.db
      .insert(etatsDesLieux)
      .values(valeurs)
      .onConflictDoUpdate({
        target: [etatsDesLieux.reservationId, etatsDesLieux.moment],
        set: valeurs,
      })
      .returning();
    await this.journal.noter({
      action: `etat_des_lieux.${c.moment}`,
      entite: "reservation",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { kilometrage: c.kilometrage, dommages: c.dommages.length },
    });
    this.diffusion.versAgence(a.agenceId, "reservation.modifiee", { id });
    return edl;
  }

  @Get("reservations/:id/etat-des-lieux/:moment/pdf")
  async pdfEtatDesLieux(
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("moment") momentBrut: string,
    @Res() res: Response,
  ) {
    const moment = z.enum(["depart", "retour"]).parse(momentBrut);
    const r = await this.reservationAccessible(id, moi);
    const [edl] = await this.db
      .select()
      .from(etatsDesLieux)
      .where(and(eq(etatsDesLieux.reservationId, id), eq(etatsDesLieux.moment, moment)));
    if (!edl) throw introuvable();
    const contexte = await this.contexte(r);
    const photos = (
      await Promise.all(
        edl.photos
          .slice(0, 9)
          .map(async (p) => ({ image: await this.lireOuNull(p.cle), prisLe: p.prisLe })),
      )
    ).filter((p): p is { image: Buffer; prisLe: string } => p.image !== null);
    const pdf = await this.pdf.etatDesLieux({
      numeroReservation: r.code,
      moment,
      agence: contexte.agence,
      client: contexte.client,
      vehicule: contexte.vehicule,
      kilometrage: edl.kilometrage,
      carburant: edl.carburant,
      dommages: edl.dommages,
      observations: edl.observations,
      photos,
      frais: moment === "retour" ? r.fraisRetour : null,
      signatureClient: await this.lireOuNull(edl.signatureClient?.image),
      signeLe: edl.signeLe,
    });
    this.envoyerPdf(res, pdf, `etat-des-lieux-${moment}-${r.code}.pdf`);
  }

  // ---------------------------------------------------------------------------
  // Contrats
  // ---------------------------------------------------------------------------

  private async contexte(r: typeof reservations.$inferSelect) {
    const [l] = await this.db
      .select({ a: agences, v: vehicules, categorie: categoriesVehicule.code })
      .from(vehicules)
      .innerJoin(agences, eq(agences.id, vehicules.agenceId))
      .innerJoin(categoriesVehicule, eq(categoriesVehicule.id, vehicules.categorieId))
      .where(eq(vehicules.id, r.vehiculeId));
    const [client] = r.clientId
      ? await this.db.select().from(utilisateurs).where(eq(utilisateurs.id, r.clientId))
      : [];
    const [permis] = r.clientId
      ? await this.db
          .select()
          .from(documentsIdentite)
          .where(
            and(
              eq(documentsIdentite.utilisateurId, r.clientId),
              eq(documentsIdentite.type, "permis"),
            ),
          )
          .orderBy(desc(documentsIdentite.createdAt))
          .limit(1)
      : [];
    const points = await this.db
      .select()
      .from(pointsRetrait)
      .where(eq(pointsRetrait.agenceId, r.agenceId));
    const lieu = (pid: string | null) => {
      const p = points.find((x) => x.id === pid);
      return p ? `${p.nom} — ${p.adresse}` : l!.a.adresse;
    };
    return {
      agenceBrute: l!.a,
      agence: {
        raisonSociale: l!.a.raisonSociale,
        adresse: l!.a.adresse,
        telephone: l!.a.telephone,
      },
      vehicule: {
        libelle: `${l!.v.marque} ${l!.v.modele} ${l!.v.annee}`,
        immatriculation: l!.v.immatriculation,
        categorie: l!.categorie,
        kmInclusParJour: r.conditions?.kmInclusParJour ?? l!.v.kmInclusParJour,
      },
      client: {
        nom: client
          ? [client.prenom, client.nom].filter(Boolean).join(" ") || client.telephone
          : "—",
        telephone: client?.telephone ?? "—",
        dateNaissance: client?.dateNaissance ?? null,
        permis: permis
          ? `${permis.numero ?? ""}${permis.dateDelivrance ? ` (${permis.dateDelivrance.split("-").reverse().join("/")})` : ""}`
          : null,
      },
      lieuDepart: lieu(r.pointRetraitDepartId),
      lieuRetour: lieu(r.pointRetraitRetourId),
    };
  }

  private async genererContrat(
    r: typeof reservations.$inferSelect,
    numero: string,
    signatures: { client?: Buffer | null; agence?: Buffer | null; signeLe?: Date | null },
  ) {
    const c = await this.contexte(r);
    const [depart] = await this.db
      .select()
      .from(etatsDesLieux)
      .where(and(eq(etatsDesLieux.reservationId, r.id), eq(etatsDesLieux.moment, "depart")));
    return this.pdf.contrat({
      numero,
      agence: {
        ...c.agence,
        nif: c.agenceBrute.nif,
        registreCommerce: c.agenceBrute.registreCommerce,
        agrement: c.agenceBrute.agrement,
        logo: await this.lireOuNull(c.agenceBrute.logoUrl),
      },
      client: c.client,
      vehicule: c.vehicule,
      debut: r.debut,
      fin: r.fin,
      lieuDepart: c.lieuDepart,
      lieuRetour: c.lieuRetour,
      detailPrix: r.detailPrix,
      prixTotal: r.prixTotal,
      caution: r.caution,
      politique: r.politiqueAnnulation,
      etatDepart: depart
        ? {
            kilometrage: depart.kilometrage,
            carburant: depart.carburant,
            dommages: depart.dommages,
          }
        : null,
      signatures,
    });
  }

  /** Signature du contrat sur tablette : numérotation, PDF figé et empreinte SHA-256 (décision D5). */
  @RouteAgence()
  @Permission("etats_des_lieux")
  @Post("agence/reservations/:id/contrat/signer")
  @DocCorps(schemas.contratSigner)
  async signer(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @AdresseIp() ip: string | null,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.contratSigner) c: z.output<typeof schemas.contratSigner>,
  ) {
    const [r] = await this.db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.agenceId, a.agenceId)));
    if (!r || r.origine === "blocage") throw introuvable();
    if (!["confirmee", "en_cours"].includes(r.statut)) throw new ErreurApi("TRANSITION_INTERDITE");
    const [existant] = await this.db.select().from(contrats).where(eq(contrats.reservationId, id));
    const annee = dateAlger(new Date()).slice(0, 4);
    const numero =
      existant?.numero ??
      `${annee}-${String(
        (
          (await this.db.execute(
            sql`SELECT count(*)::int AS n FROM contrats WHERE agence_id = ${a.agenceId} AND numero LIKE ${`${annee}-%`}`,
          )) as unknown as { n: number }[]
        )[0]!.n + 1,
      ).padStart(5, "0")}`;

    const cleClient = await this.deposerSignature(c.signatureClient, id, "contrat-client");
    const cleAgence = c.signatureAgence
      ? await this.deposerSignature(c.signatureAgence, id, "contrat-agence")
      : null;
    const signeLe = new Date();
    const pdf = await this.genererContrat(r, numero, {
      client: depuisDataUrl(c.signatureClient).contenu,
      agence: c.signatureAgence ? depuisDataUrl(c.signatureAgence).contenu : null,
      signeLe,
    });
    const clePdf = `contrats/${a.agenceId}/${numero}.pdf`;
    await this.stockage.deposer(clePdf, pdf, "application/pdf");
    const valeurs = {
      agenceId: a.agenceId,
      reservationId: id,
      numero,
      pdfUrl: clePdf,
      empreintePdf: sha256(pdf),
      signeLe,
      signatureClient: { image: cleClient, ...(ip ? { ip } : {}) },
      signatureAgence: cleAgence ? { image: cleAgence, parUtilisateurId: moi.id } : null,
    };
    const [contrat] = await this.db
      .insert(contrats)
      .values(valeurs)
      .onConflictDoUpdate({ target: contrats.reservationId, set: valeurs })
      .returning();
    await this.journal.noter({
      action: "contrat.signer",
      entite: "reservation",
      entiteId: id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { numero, empreinte: valeurs.empreintePdf },
      ip,
    });
    this.diffusion.versAgence(a.agenceId, "reservation.modifiee", { id });
    return contrat;
  }

  /** PDF du contrat : version signée si elle existe, sinon brouillon généré à la volée. */
  @Get("contrats/:reservationId/pdf")
  async pdfContrat(
    @Moi() moi: UtilisateurConnecte,
    @Param("reservationId", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const r = await this.reservationAccessible(id, moi);
    if (r.origine === "blocage") throw introuvable();
    const [contrat] = await this.db.select().from(contrats).where(eq(contrats.reservationId, id));
    const pdf = contrat?.pdfUrl
      ? await this.stockage.lire(contrat.pdfUrl)
      : await this.genererContrat(r, `${r.code} (brouillon)`, {});
    this.envoyerPdf(res, pdf, `contrat-${contrat?.numero ?? r.code}.pdf`);
  }

  @Get("contrats/:reservationId")
  async infosContrat(
    @Moi() moi: UtilisateurConnecte,
    @Param("reservationId", ParseUUIDPipe) id: string,
  ) {
    await this.reservationAccessible(id, moi);
    const [contrat] = await this.db.select().from(contrats).where(eq(contrats.reservationId, id));
    return contrat ?? null;
  }

  private envoyerPdf(res: Response, pdf: Buffer, nom: string) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nom}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  }
}
