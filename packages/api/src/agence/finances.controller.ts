import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  agences,
  amendes,
  categoriesVehicule,
  entretiens,
  factures,
  paiements,
  reservations,
  utilisateurs,
  vehicules,
} from "@lvb/db";
import {
  type Langue,
  dateAlger,
  numeroFacture,
  schemas,
  traduire,
  trouverLocationResponsable,
} from "@lvb/shared";
import ExcelJS from "exceljs";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Response } from "express";
import type { z } from "zod";
import { MonAgence, Moi, Permission, RouteAgence } from "../auth/decorateurs.js";
import type { ContexteAgence, UtilisateurConnecte } from "../auth/types.js";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi, introuvable } from "../commun/erreur-api.js";
import { JournalService } from "../commun/journal.service.js";
import { LangueRequete } from "../commun/langue.js";
import { Corps, DocCorps, Requete } from "../commun/zod.js";
import { GenerateurPdf } from "../documents/pdf.js";
import { Stockage } from "../fichiers/stockage.js";

/** Amendes, factures et export comptable (section 4.9). */
@ApiTags("Finances")
@ApiBearerAuth()
@RouteAgence()
@Controller("agence")
export class FinancesController {
  constructor(
    @InjectBase() private readonly db: Base,
    private readonly pdf: GenerateurPdf,
    private readonly stockage: Stockage,
    private readonly journal: JournalService,
  ) {}

  // ---------------------------------------------------------------------------
  // Amendes : retrouver le conducteur responsable
  // ---------------------------------------------------------------------------

  private async responsable(agenceId: string, vehiculeId: string, date: Date) {
    const locations = await this.db
      .select()
      .from(reservations)
      .where(
        and(
          eq(reservations.agenceId, agenceId),
          eq(reservations.vehiculeId, vehiculeId),
          inArray(reservations.statut, ["en_cours", "terminee", "litige"]),
          // Fenêtre large : le retour réel peut dépasser la fin prévue.
          sql`${reservations.debut} <= ${date.toISOString()}::timestamptz + interval '1 day'`,
          sql`coalesce(${reservations.retourLe}, ${reservations.fin}) >= ${date.toISOString()}::timestamptz - interval '1 day'`,
        ),
      );
    return trouverLocationResponsable(date, locations);
  }

  @Get("amendes")
  async listerAmendes(@MonAgence() a: ContexteAgence) {
    return this.db
      .select({
        m: amendes,
        vehicule: sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
        immatriculation: vehicules.immatriculation,
        client: sql<
          string | null
        >`nullif(trim(coalesce(${utilisateurs.prenom}, '') || ' ' || coalesce(${utilisateurs.nom}, '')), '')`,
        telephone: utilisateurs.telephone,
        code: reservations.code,
      })
      .from(amendes)
      .innerJoin(vehicules, eq(vehicules.id, amendes.vehiculeId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, amendes.clientId))
      .leftJoin(reservations, eq(reservations.id, amendes.reservationId))
      .where(eq(amendes.agenceId, a.agenceId))
      .orderBy(desc(amendes.dateInfraction))
      .limit(300)
      .then((l) =>
        l.map((x) => ({
          ...x.m,
          vehicule: x.vehicule,
          immatriculation: x.immatriculation,
          client: x.client,
          telephone: x.telephone,
          code: x.code,
        })),
      );
  }

  /** Aperçu avant enregistrement : qui conduisait à cette date ? */
  @Get("amendes/responsable")
  async apercuResponsable(
    @MonAgence() a: ContexteAgence,
    @Requete(schemas.amendeCreer.pick({ vehiculeId: true, dateInfraction: true }))
    q: { vehiculeId: string; dateInfraction: Date },
  ) {
    const r = await this.responsable(a.agenceId, q.vehiculeId, q.dateInfraction);
    if (!r?.clientId) return null;
    const [c] = await this.db
      .select({
        nom: utilisateurs.nom,
        prenom: utilisateurs.prenom,
        telephone: utilisateurs.telephone,
      })
      .from(utilisateurs)
      .where(eq(utilisateurs.id, r.clientId));
    return { reservationId: r.id, clientId: r.clientId, ...c };
  }

  @Permission("encaissements")
  @Post("amendes")
  @DocCorps(schemas.amendeCreer)
  async creerAmende(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Corps(schemas.amendeCreer) c: z.output<typeof schemas.amendeCreer>,
  ) {
    const [v] = await this.db
      .select({ id: vehicules.id })
      .from(vehicules)
      .where(and(eq(vehicules.id, c.vehiculeId), eq(vehicules.agenceId, a.agenceId)));
    if (!v) throw introuvable();
    const r = await this.responsable(a.agenceId, c.vehiculeId, c.dateInfraction);
    const [m] = await this.db
      .insert(amendes)
      .values({
        ...c,
        agenceId: a.agenceId,
        lieu: c.lieu ?? null,
        reference: c.reference ?? null,
        reservationId: r?.id ?? null,
        clientId: r?.clientId ?? null,
        creePar: moi.id,
      })
      .returning();
    await this.journal.noter({
      action: "amende.creer",
      entite: "amende",
      entiteId: m!.id,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { montant: c.montant, reservation: r?.id ?? null },
    });
    return m;
  }

  @Permission("encaissements")
  @Patch("amendes/:id")
  @DocCorps(schemas.amendeModifier)
  async modifierAmende(
    @MonAgence() a: ContexteAgence,
    @Param("id", ParseUUIDPipe) id: string,
    @Corps(schemas.amendeModifier) c: z.output<typeof schemas.amendeModifier>,
  ) {
    const [m] = await this.db
      .update(amendes)
      .set(c)
      .where(and(eq(amendes.id, id), eq(amendes.agenceId, a.agenceId)))
      .returning();
    if (!m) throw introuvable();
    return m;
  }

  // ---------------------------------------------------------------------------
  // Factures
  // ---------------------------------------------------------------------------

  /** Facture PDF d'une réservation, numérotée à la première émission (F-AAAA-00001). */
  @Get("reservations/:id/facture/pdf")
  async facture(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const [r] = await this.db
      .select()
      .from(reservations)
      .where(and(eq(reservations.id, id), eq(reservations.agenceId, a.agenceId)));
    if (!r || r.origine === "blocage") throw introuvable();
    if (!["confirmee", "en_cours", "terminee", "litige"].includes(r.statut))
      throw new ErreurApi("TRANSITION_INTERDITE");
    const total = r.prixTotal + (r.fraisRetour?.total ?? 0);

    let [f] = await this.db.select().from(factures).where(eq(factures.reservationId, id));
    if (!f) {
      f = await this.db.transaction(async (tx) => {
        // Verrou par agence : deux factures émises en même temps ne reçoivent pas le même numéro.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${a.agenceId}))`);
        const annee = dateAlger(new Date()).slice(0, 4);
        const [{ n }] = (await tx.execute(
          sql`SELECT count(*)::int AS n FROM factures WHERE agence_id = ${a.agenceId} AND numero LIKE ${`F-${annee}-%`}`,
        )) as unknown as [{ n: number }];
        const [cree] = await tx
          .insert(factures)
          .values({
            agenceId: a.agenceId,
            reservationId: id,
            numero: numeroFacture(annee, n + 1),
            montant: total,
          })
          .onConflictDoNothing()
          .returning();
        return cree ?? (await tx.select().from(factures).where(eq(factures.reservationId, id)))[0]!;
      });
      await this.journal.noter({
        action: "facture.emettre",
        entite: "reservation",
        entiteId: id,
        agenceId: a.agenceId,
        utilisateurId: moi.id,
        details: { numero: f.numero, montant: total },
      });
    }

    const [ag] = await this.db.select().from(agences).where(eq(agences.id, a.agenceId));
    const [v] = await this.db.select().from(vehicules).where(eq(vehicules.id, r.vehiculeId));
    const [c] = r.clientId
      ? await this.db.select().from(utilisateurs).where(eq(utilisateurs.id, r.clientId))
      : [];
    const [{ paye }] = (await this.db
      .select({
        paye: sql<number>`coalesce(sum(case when ${paiements.type} in ('acompte','solde','frais') then ${paiements.montant} when ${paiements.type} = 'remboursement' then -${paiements.montant} else 0 end), 0)::int`,
      })
      .from(paiements)
      .where(and(eq(paiements.reservationId, id), eq(paiements.statut, "reussi")))) as [
      { paye: number },
    ];
    const d = r.detailPrix;
    const lignes = [
      ...(d
        ? [
            {
              cle: "pdf.location",
              detail: `${traduire("fr", "commun.jours", { n: d.jours })} × ${d.prixJourApplique} DA`,
              montant: d.sousTotalLocation,
            },
          ]
        : [{ cle: "pdf.location", detail: "", montant: r.prixTotal }]),
      ...(d?.options ?? []).map((o) => ({
        cle: `options.${o.code}`,
        detail: "",
        montant: o.montant,
      })),
      ...(d && d.fraisLivraison
        ? [
            {
              cle: "pdf.livraison",
              detail: r.livraison ? `${r.livraison.adresse}, ${r.livraison.commune}` : "",
              montant: d.fraisLivraison,
            },
          ]
        : []),
      ...(r.fraisRetour?.total
        ? [{ cle: "pdf.fraisRetour", detail: "", montant: r.fraisRetour.total }]
        : []),
    ];
    let logo: Buffer | null = null;
    if (ag!.logoUrl) logo = await this.stockage.lire(ag!.logoUrl).catch(() => null);
    const pdf = await this.pdf.facture({
      numero: f.numero,
      emiseLe: f.emiseLe,
      codeReservation: r.code,
      agence: {
        raisonSociale: ag!.raisonSociale,
        adresse: ag!.adresse,
        telephone: ag!.telephone,
        nif: ag!.nif,
        registreCommerce: ag!.registreCommerce,
        agrement: ag!.agrement,
        logo,
      },
      client: {
        nom: c ? [c.prenom, c.nom].filter(Boolean).join(" ") || c.telephone : "—",
        telephone: c?.telephone ?? "—",
      },
      vehicule: `${v!.marque} ${v!.modele} (${v!.immatriculation})`,
      debut: r.debut,
      fin: r.retourLe ?? r.fin,
      lignes,
      total,
      dejaPaye: paye,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${f.numero}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(pdf);
  }

  // ---------------------------------------------------------------------------
  // Export comptable Excel
  // ---------------------------------------------------------------------------

  @Permission("encaissements")
  @Get("export.xlsx")
  async exporter(
    @MonAgence() a: ContexteAgence,
    @Moi() moi: UtilisateurConnecte,
    @LangueRequete() langue: Langue,
    @Requete(schemas.exportParams) p: z.output<typeof schemas.exportParams>,
    @Res() res: Response,
  ) {
    const t = (cle: string) => traduire(langue, cle);
    const classeur = new ExcelJS.Workbook();
    classeur.creator = "Location Béjaïa";
    const entete = (f: ExcelJS.Worksheet) => {
      f.getRow(1).font = { bold: true };
      f.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E8FF" } };
      f.views = [{ state: "frozen", ySplit: 1, rightToLeft: langue === "ar" }];
    };
    const montant = { numFmt: '#,##0 "DA"' } as const;

    const lesReservations = await this.db
      .select({
        r: reservations,
        vehicule: sql<string>`${vehicules.marque} || ' ' || ${vehicules.modele}`,
        immatriculation: vehicules.immatriculation,
        categorie: categoriesVehicule.code,
        client: utilisateurs.telephone,
        facture: factures.numero,
      })
      .from(reservations)
      .innerJoin(vehicules, eq(vehicules.id, reservations.vehiculeId))
      .innerJoin(categoriesVehicule, eq(categoriesVehicule.id, vehicules.categorieId))
      .leftJoin(utilisateurs, eq(utilisateurs.id, reservations.clientId))
      .leftJoin(factures, eq(factures.reservationId, reservations.id))
      .where(
        and(
          eq(reservations.agenceId, a.agenceId),
          sql`${reservations.origine} <> 'blocage'`,
          gte(reservations.debut, p.debut),
          lt(reservations.debut, p.fin),
        ),
      )
      .orderBy(asc(reservations.debut));
    const f1 = classeur.addWorksheet(t("loueur.nav.reservations"));
    f1.columns = [
      { header: t("loueur.reservations.code"), key: "code", width: 14 },
      { header: t("factures.facture"), key: "facture", width: 15 },
      { header: t("loueur.reservations.origine"), key: "origine", width: 12 },
      { header: t("commun.statut"), key: "statut", width: 20 },
      { header: t("pdf.depart"), key: "debut", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: t("pdf.retour"), key: "fin", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: t("loueur.reservations.vehicule"), key: "vehicule", width: 22 },
      { header: t("pdf.immatriculation"), key: "immatriculation", width: 16 },
      { header: t("loueur.reservations.client"), key: "client", width: 16 },
      { header: t("loueur.reservations.montant"), key: "montant", width: 14, style: montant },
      { header: t("pdf.fraisRetour"), key: "frais", width: 14, style: montant },
      { header: t("pdf.caution"), key: "caution", width: 14, style: montant },
    ];
    // Les dates sont écrites en heure d'Alger (Excel ne gère pas les fuseaux).
    const alger = (d: Date) => new Date(d.getTime() + 60 * 60_000);
    for (const l of lesReservations)
      f1.addRow({
        code: l.r.code,
        facture: l.facture ?? "",
        origine: t(`origines.${l.r.origine}`),
        statut: t(`statutsReservation.${l.r.statut}`),
        debut: alger(l.r.debut),
        fin: alger(l.r.fin),
        vehicule: l.vehicule,
        immatriculation: l.immatriculation,
        client: l.client ?? "",
        montant: l.r.prixTotal,
        frais: l.r.fraisRetour?.total ?? 0,
        caution: l.r.caution,
      });
    entete(f1);

    const lesPaiements = await this.db
      .select({ p: paiements, code: reservations.code })
      .from(paiements)
      .innerJoin(reservations, eq(reservations.id, paiements.reservationId))
      .where(
        and(
          eq(paiements.agenceId, a.agenceId),
          gte(paiements.createdAt, p.debut),
          lt(paiements.createdAt, p.fin),
        ),
      )
      .orderBy(asc(paiements.createdAt));
    const f2 = classeur.addWorksheet(t("loueur.reservations.paiements"));
    f2.columns = [
      { header: t("ui.date"), key: "date", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: t("loueur.reservations.code"), key: "code", width: 14 },
      { header: t("loueur.entretien.type"), key: "type", width: 20 },
      { header: t("factures.moyen"), key: "moyen", width: 16 },
      { header: t("loueur.reservations.montant"), key: "montant", width: 14, style: montant },
    ];
    for (const l of lesPaiements)
      f2.addRow({
        date: alger(l.p.createdAt),
        code: l.code,
        type: t(`typesPaiement.${l.p.type}`),
        moyen: t(`moyensPaiement.${l.p.moyen}`),
        montant: l.p.montant,
      });
    entete(f2);

    const lesEntretiens = await this.db
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
          gte(entretiens.date, dateAlger(p.debut)),
          lt(entretiens.date, dateAlger(p.fin)),
        ),
      )
      .orderBy(asc(entretiens.date));
    const f3 = classeur.addWorksheet(t("loueur.entretien.titre"));
    f3.columns = [
      { header: t("loueur.entretien.date"), key: "date", width: 14 },
      { header: t("loueur.entretien.type"), key: "type", width: 20 },
      { header: t("loueur.reservations.vehicule"), key: "vehicule", width: 22 },
      { header: t("pdf.immatriculation"), key: "immatriculation", width: 16 },
      { header: t("loueur.entretien.prestataire"), key: "prestataire", width: 20 },
      { header: t("loueur.entretien.cout"), key: "cout", width: 14, style: montant },
    ];
    for (const l of lesEntretiens)
      f3.addRow({
        date: l.e.date,
        type: t(`loueur.entretien.types.${l.e.type}`),
        vehicule: l.vehicule,
        immatriculation: l.immatriculation,
        prestataire: l.e.prestataire ?? "",
        cout: l.e.cout,
      });
    entete(f3);

    await this.journal.noter({
      action: "export.comptable",
      entite: "agence",
      entiteId: a.agenceId,
      agenceId: a.agenceId,
      utilisateurId: moi.id,
      details: { debut: p.debut, fin: p.fin },
    });
    const contenu = Buffer.from(await classeur.xlsx.writeBuffer());
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="export-${dateAlger(p.debut)}-${dateAlger(p.fin)}.xlsx"`,
    );
    res.send(contenu);
  }
}
