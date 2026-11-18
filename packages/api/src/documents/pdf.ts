import { createRequire } from "node:module";
import { Injectable } from "@nestjs/common";
import { type DetailPrix, type Dommage, type FraisRetour } from "@lvb/db";
import { dateAlger, formaterDZD, heureAlger, traduire } from "@lvb/shared";
import PDFDocument from "pdfkit";

const exiger = createRequire(import.meta.url);
const POLICES = {
  latin: exiger.resolve("@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff"),
  latinGras: exiger.resolve("@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff"),
  arabe: exiger.resolve(
    "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-400-normal.woff",
  ),
  arabeGras: exiger.resolve(
    "@fontsource/noto-naskh-arabic/files/noto-naskh-arabic-arabic-700-normal.woff",
  ),
};

const MARGE = 40;
const LARGEUR = 595.28 - 2 * MARGE;
const GRIS = "#5b6472";
const TRAIT = "#d5d9e0";

export type DonneesContrat = {
  numero: string;
  agence: {
    raisonSociale: string;
    adresse: string;
    telephone: string;
    nif: string;
    registreCommerce: string;
    agrement: string | null;
    logo?: Buffer | null;
  };
  client: { nom: string; telephone: string; dateNaissance: string | null; permis: string | null };
  vehicule: {
    libelle: string;
    immatriculation: string;
    categorie: string;
    kmInclusParJour: number | null;
  };
  debut: Date;
  fin: Date;
  lieuDepart: string;
  lieuRetour: string;
  detailPrix: DetailPrix | null;
  prixTotal: number;
  caution: number;
  politique: "souple" | "moderee" | "stricte";
  etatDepart: { kilometrage: number; carburant: number; dommages: Dommage[] } | null;
  signatures: { client?: Buffer | null; agence?: Buffer | null; signeLe?: Date | null };
};

export type DonneesFacture = {
  numero: string;
  emiseLe: Date;
  codeReservation: string;
  agence: {
    raisonSociale: string;
    adresse: string;
    telephone: string;
    nif: string;
    registreCommerce: string;
    agrement: string | null;
    logo?: Buffer | null;
  };
  client: { nom: string; telephone: string };
  vehicule: string;
  debut: Date;
  fin: Date;
  lignes: { cle: string; detail: string; montant: number }[];
  total: number;
  dejaPaye: number;
};

export type DonneesEtatDesLieux = {
  numeroReservation: string;
  moment: "depart" | "retour";
  agence: { raisonSociale: string; adresse: string; telephone: string };
  client: { nom: string; telephone: string };
  vehicule: { libelle: string; immatriculation: string };
  kilometrage: number;
  carburant: number;
  dommages: Dommage[];
  observations: string | null;
  photos: { image: Buffer; prisLe: string }[];
  frais: FraisRetour | null;
  signatureClient: Buffer | null;
  signeLe: Date | null;
};

const ESPACES_INSECABLES = new RegExp("[" + String.fromCharCode(0x202f, 0xa0) + "]", "g");
const fr = (cle: string, v?: Record<string, string | number>) => traduire("fr", cle, v);
const ar = (cle: string) => traduire("ar", cle);
const dateHeure = (d: Date) => `${dateAlger(d).split("-").reverse().join("/")} ${heureAlger(d)}`;
const dzd = (n: number) => formaterDZD(n, "fr").replace(ESPACES_INSECABLES, " ");

/**
 * Génération des PDF côté serveur (contrat bilingue français / arabe, états des lieux).
 * Les libellés arabes sont écrits seuls sur leur ligne (police arabe, alignés à droite) ;
 * les valeurs (dates, montants, immatriculations) restent en chiffres latins à gauche,
 * ce qui évite les problèmes d'ordre bidirectionnel.
 */
@Injectable()
export class GenerateurPdf {
  private nouveau() {
    const doc = new PDFDocument({ size: "A4", margin: MARGE, info: { Producer: "lvb" } });
    doc.registerFont("latin", POLICES.latin);
    doc.registerFont("latinGras", POLICES.latinGras);
    doc.registerFont("arabe", POLICES.arabe);
    doc.registerFont("arabeGras", POLICES.arabeGras);
    return doc;
  }

  private terminer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((ok, ko) => {
      const morceaux: Buffer[] = [];
      doc.on("data", (m: Buffer) => morceaux.push(m));
      doc.on("end", () => ok(Buffer.concat(morceaux)));
      doc.on("error", ko);
      doc.end();
    });
  }

  private place(doc: PDFKit.PDFDocument, hauteur: number) {
    if (doc.y + hauteur > doc.page.height - MARGE) doc.addPage();
  }

  /** Titre bilingue : français à gauche, arabe à droite, sur la même ligne. */
  private titre(doc: PDFKit.PDFDocument, cle: string, taille = 15) {
    this.place(doc, taille * 2.4);
    const y = doc.y;
    doc
      .font("latinGras")
      .fontSize(taille)
      .fillColor("#111")
      .text(fr(cle), MARGE, y, { width: LARGEUR / 2 });
    doc
      .font("arabeGras")
      .fontSize(taille + 1)
      .text(ar(cle), MARGE + LARGEUR / 2, y - 2, { width: LARGEUR / 2, align: "right" });
    doc.y = y + taille * 1.8;
  }

  private section(doc: PDFKit.PDFDocument, cle: string) {
    this.place(doc, 40);
    doc.moveDown(0.4);
    const y = doc.y;
    doc.rect(MARGE, y, LARGEUR, 20).fill("#eef1f5");
    doc
      .font("latinGras")
      .fontSize(10)
      .fillColor("#111")
      .text(fr(cle), MARGE + 6, y + 5, { width: LARGEUR / 2 });
    doc
      .font("arabeGras")
      .fontSize(11)
      .text(ar(cle), MARGE + LARGEUR / 2, y + 2, { width: LARGEUR / 2 - 6, align: "right" });
    doc.y = y + 26;
  }

  /** Ligne « libellé FR | valeur | libellé AR ». */
  private ligne(doc: PDFKit.PDFDocument, cle: string, valeur: string) {
    this.place(doc, 18);
    const y = doc.y;
    const col = LARGEUR / 3.2;
    doc
      .font("latin")
      .fontSize(8.5)
      .fillColor(GRIS)
      .text(fr(cle), MARGE, y + 1, { width: col });
    doc
      .font("latinGras")
      .fontSize(9.5)
      .fillColor("#111")
      .text(valeur, MARGE + col, y, { width: LARGEUR - 2 * col });
    const hauteurValeur = doc.y - y;
    doc
      .font("arabe")
      .fontSize(9.5)
      .fillColor(GRIS)
      .text(ar(cle), MARGE + LARGEUR - col, y - 2, { width: col, align: "right" });
    doc.y = y + Math.max(16, hauteurValeur + 3);
    doc
      .moveTo(MARGE, doc.y - 2)
      .lineTo(MARGE + LARGEUR, doc.y - 2)
      .strokeColor(TRAIT)
      .lineWidth(0.5)
      .stroke();
  }

  private entete(
    doc: PDFKit.PDFDocument,
    agence: { raisonSociale: string; adresse: string; telephone: string; logo?: Buffer | null },
    droite: string[],
  ) {
    const y = MARGE;
    let x = MARGE;
    if (agence.logo) {
      try {
        doc.image(agence.logo, MARGE, y, { fit: [60, 40] });
        x += 70;
      } catch {
        /* logo illisible : ignoré */
      }
    }
    doc
      .font("latinGras")
      .fontSize(13)
      .fillColor("#111")
      .text(agence.raisonSociale, x, y, { width: 300 });
    doc
      .font("latin")
      .fontSize(8.5)
      .fillColor(GRIS)
      .text(`${agence.adresse}\n${agence.telephone}`, x, doc.y + 1, { width: 300 });
    doc
      .font("latin")
      .fontSize(8.5)
      .fillColor(GRIS)
      .text(droite.join("\n"), MARGE + LARGEUR - 200, y, { width: 200, align: "right" });
    doc.y = Math.max(doc.y, y + 50) + 10;
    doc
      .moveTo(MARGE, doc.y)
      .lineTo(MARGE + LARGEUR, doc.y)
      .strokeColor("#111")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);
  }

  private signatures(
    doc: PDFKit.PDFDocument,
    client: Buffer | null | undefined,
    agence: Buffer | null | undefined,
    signeLe: Date | null | undefined,
    avecAgence = true,
  ) {
    this.place(doc, 130);
    doc.moveDown(0.8);
    const y = doc.y;
    const largeur = (LARGEUR - 20) / 2;
    const cadres: [string, Buffer | null | undefined, number][] = [
      ["pdf.signatureLocataire", client, MARGE],
    ];
    if (avecAgence) cadres.push(["pdf.signatureLoueur", agence, MARGE + largeur + 20]);
    for (const [cle, image, x] of cadres) {
      doc
        .font("latin")
        .fontSize(8.5)
        .fillColor(GRIS)
        .text(fr(cle), x, y, { width: largeur / 2 });
      doc
        .font("arabe")
        .fontSize(9)
        .text(ar(cle), x + largeur / 2, y - 2, { width: largeur / 2, align: "right" });
      doc
        .rect(x, y + 16, largeur, 80)
        .strokeColor(TRAIT)
        .lineWidth(0.8)
        .stroke();
      if (image) {
        try {
          doc.image(image, x + 8, y + 20, {
            fit: [largeur - 16, 72],
            align: "center",
            valign: "center",
          });
        } catch {
          /* image de signature illisible */
        }
      }
    }
    doc.y = y + 102;
    if (signeLe)
      doc
        .font("latin")
        .fontSize(8)
        .fillColor(GRIS)
        .text(fr("pdf.signeLe", { date: dateHeure(signeLe) }), MARGE, doc.y, { width: LARGEUR });
  }

  /** Schéma du véhicule vu de dessus, avec les dommages pointés et numérotés. */
  private schema(doc: PDFKit.PDFDocument, dommages: Dommage[]) {
    this.place(doc, 170);
    const l = 110;
    const h = 160;
    const x = MARGE + (LARGEUR - l) / 2;
    const y = doc.y + 4;
    doc.roundedRect(x, y, l, h, 30).strokeColor("#333").lineWidth(1.2).stroke();
    doc
      .roundedRect(x + 14, y + 32, l - 28, 30, 6)
      .strokeColor("#888")
      .lineWidth(0.8)
      .stroke(); // pare-brise
    doc.roundedRect(x + 14, y + h - 50, l - 28, 22, 6).stroke(); // lunette arrière
    dommages.forEach((d, i) => {
      const px = x + d.x * l;
      const py = y + d.y * h;
      doc.circle(px, py, 6).fill("#d62828");
      doc
        .font("latinGras")
        .fontSize(7)
        .fillColor("#fff")
        .text(String(i + 1), px - 6, py - 4, { width: 12, align: "center" });
    });
    doc.y = y + h + 10;
    doc.fillColor("#111");
  }

  private listeDommages(doc: PDFKit.PDFDocument, dommages: Dommage[]) {
    if (!dommages.length) return this.ligne(doc, "pdf.dommages", fr("pdf.aucunDommage"));
    this.ligne(
      doc,
      "pdf.dommages",
      dommages
        .map(
          (d, i) => `${i + 1}. ${d.zone} — ${d.type}${d.description ? ` : ${d.description}` : ""}`,
        )
        .join("\n"),
    );
  }

  async contrat(d: DonneesContrat): Promise<Buffer> {
    const doc = this.nouveau();
    this.entete(doc, d.agence, [
      `${fr("pdf.nif")} : ${d.agence.nif}`,
      `${fr("pdf.rc")} : ${d.agence.registreCommerce}`,
      ...(d.agence.agrement ? [`${fr("pdf.agrement")} : ${d.agence.agrement}`] : []),
    ]);
    this.titre(doc, "pdf.contratTitre");
    this.ligne(doc, "pdf.numero", d.numero);

    this.section(doc, "pdf.locataire");
    this.ligne(doc, "commun.nom", d.client.nom);
    this.ligne(doc, "commun.telephone", d.client.telephone);
    if (d.client.dateNaissance)
      this.ligne(
        doc,
        "commun.dateNaissance",
        d.client.dateNaissance.split("-").reverse().join("/"),
      );
    if (d.client.permis) this.ligne(doc, "pdf.permis", d.client.permis);

    this.section(doc, "pdf.vehicule");
    this.ligne(
      doc,
      "pdf.vehicule",
      `${d.vehicule.libelle} (${fr(`categories.${d.vehicule.categorie}`)})`,
    );
    this.ligne(doc, "pdf.immatriculation", d.vehicule.immatriculation);
    this.ligne(
      doc,
      "pdf.kmInclus",
      d.vehicule.kmInclusParJour === null
        ? fr("pdf.illimite")
        : fr("pdf.parJour", { km: d.vehicule.kmInclusParJour }),
    );

    this.section(doc, "pdf.periode");
    this.ligne(doc, "pdf.depart", dateHeure(d.debut));
    this.ligne(doc, "pdf.retour", dateHeure(d.fin));
    this.ligne(doc, "pdf.lieuDepart", d.lieuDepart);
    this.ligne(doc, "pdf.lieuRetour", d.lieuRetour);

    this.section(doc, "pdf.prix");
    const p = d.detailPrix;
    if (p) {
      this.ligne(
        doc,
        "pdf.prix",
        `${fr("commun.jours", { n: p.jours })} × ${dzd(p.prixJourApplique)} = ${dzd(p.sousTotalLocation)}`,
      );
      if (p.options.length)
        this.ligne(
          doc,
          "pdf.options",
          p.options.map((o) => `${fr(`options.${o.code}`)} : ${dzd(o.montant)}`).join("\n"),
        );
    }
    this.ligne(doc, "commun.total", dzd(d.prixTotal));
    this.ligne(doc, "pdf.caution", dzd(d.caution));
    this.ligne(
      doc,
      "pdf.politiqueAnnulation",
      `${fr(`politiques.${d.politique}`)} — ${fr(`politiques.${d.politique}_detail`)}`,
    );

    if (d.etatDepart) {
      this.section(doc, "pdf.etatDesLieuxTitre");
      this.ligne(
        doc,
        "pdf.kilometrage",
        `${d.etatDepart.kilometrage.toLocaleString("fr-FR").replace(ESPACES_INSECABLES, " ")} km`,
      );
      this.ligne(doc, "pdf.carburant", fr("pdf.huitiemes", { n: d.etatDepart.carburant }));
      this.listeDommages(doc, d.etatDepart.dommages);
    }

    this.section(doc, "pdf.conditions");
    doc
      .font("latin")
      .fontSize(8.5)
      .fillColor("#222")
      .text(fr("pdf.conditionsTexte"), MARGE, doc.y, { width: LARGEUR, align: "justify" });
    doc.moveDown(0.5);
    this.place(doc, 60);
    doc
      .font("arabe")
      .fontSize(9.5)
      .fillColor("#222")
      .text(ar("pdf.conditionsTexte"), MARGE, doc.y, { width: LARGEUR, align: "right" });

    this.signatures(doc, d.signatures.client, d.signatures.agence, d.signatures.signeLe);
    doc
      .font("latin")
      .fontSize(7)
      .fillColor(GRIS)
      .text(
        fr("pdf.genereLe", { date: dateHeure(new Date()) }),
        MARGE,
        doc.page.height - MARGE - 10,
        { width: LARGEUR, align: "right" },
      );
    return this.terminer(doc);
  }

  /** Facture bilingue (4.9) : lignes de prestation, total, déjà encaissé, reste à payer. */
  async facture(d: DonneesFacture): Promise<Buffer> {
    const doc = this.nouveau();
    this.entete(doc, d.agence, [
      `${fr("pdf.nif")} : ${d.agence.nif}`,
      `${fr("pdf.rc")} : ${d.agence.registreCommerce}`,
      ...(d.agence.agrement ? [`${fr("pdf.agrement")} : ${d.agence.agrement}`] : []),
    ]);
    this.titre(doc, "pdf.factureTitre");
    this.ligne(doc, "pdf.numeroFacture", d.numero);
    this.ligne(doc, "pdf.dateFacture", dateHeure(d.emiseLe));
    this.ligne(doc, "pdf.numero", d.codeReservation);
    this.section(doc, "pdf.client");
    this.ligne(doc, "commun.nom", d.client.nom);
    this.ligne(doc, "commun.telephone", d.client.telephone);
    this.section(doc, "pdf.designation");
    this.ligne(doc, "pdf.vehicule", `${d.vehicule} — ${dateHeure(d.debut)} / ${dateHeure(d.fin)}`);
    for (const l of d.lignes)
      this.ligne(doc, l.cle, `${l.detail ? `${l.detail} — ` : ""}${dzd(l.montant)}`);
    this.section(doc, "pdf.totalAPayer");
    this.ligne(doc, "pdf.totalAPayer", dzd(d.total));
    this.ligne(doc, "pdf.dejaPaye", dzd(d.dejaPaye));
    this.ligne(doc, "pdf.resteAPayer", dzd(Math.max(0, d.total - d.dejaPaye)));
    doc.moveDown(1);
    doc
      .font("latin")
      .fontSize(8.5)
      .fillColor(GRIS)
      .text(fr("pdf.mentionsFacture"), MARGE, doc.y, { width: LARGEUR / 2 });
    doc
      .font("arabe")
      .fontSize(9)
      .text(ar("pdf.mentionsFacture"), MARGE + LARGEUR / 2, doc.y - 12, {
        width: LARGEUR / 2,
        align: "right",
      });
    doc.moveDown(1);
    doc
      .font("latinGras")
      .fontSize(10)
      .fillColor("#111")
      .text(fr("pdf.merci"), MARGE, doc.y, { width: LARGEUR / 2 });
    doc
      .font("arabeGras")
      .fontSize(11)
      .text(ar("pdf.merci"), MARGE + LARGEUR / 2, doc.y - 14, {
        width: LARGEUR / 2,
        align: "right",
      });
    return this.terminer(doc);
  }

  async etatDesLieux(d: DonneesEtatDesLieux): Promise<Buffer> {
    const doc = this.nouveau();
    this.entete(doc, d.agence, [`${fr("pdf.numero")} ${d.numeroReservation}`]);
    this.titre(doc, "pdf.etatDesLieuxTitre");
    this.ligne(doc, "pdf.locataire", `${d.client.nom} — ${d.client.telephone}`);
    this.ligne(doc, "pdf.vehicule", `${d.vehicule.libelle} — ${d.vehicule.immatriculation}`);
    this.ligne(
      doc,
      d.moment === "depart" ? "pdf.depart" : "pdf.retour",
      d.signeLe ? dateHeure(d.signeLe) : "—",
    );
    this.ligne(
      doc,
      "pdf.kilometrage",
      `${d.kilometrage.toLocaleString("fr-FR").replace(ESPACES_INSECABLES, " ")} km`,
    );
    this.ligne(doc, "pdf.carburant", fr("pdf.huitiemes", { n: d.carburant }));

    this.section(doc, "pdf.dommages");
    this.schema(doc, d.dommages);
    this.listeDommages(doc, d.dommages);
    if (d.observations) this.ligne(doc, "pdf.observations", d.observations);

    if (d.frais) {
      this.section(doc, "pdf.fraisRetour");
      this.ligne(
        doc,
        "pdf.kmSupplementaires",
        `${d.frais.kmSupplementaires} km — ${dzd(d.frais.montantKm)}`,
      );
      this.ligne(
        doc,
        "pdf.carburantManquant",
        `${d.frais.huitiemesManquants}/8 — ${dzd(d.frais.montantCarburant)}`,
      );
      this.ligne(
        doc,
        "pdf.retard",
        `${fr("commun.jours", { n: d.frais.joursRetard })} — ${dzd(d.frais.montantRetard)}`,
      );
      this.ligne(doc, "pdf.dommages", dzd(d.frais.montantDommages));
      this.ligne(doc, "commun.total", dzd(d.frais.total));
    }

    if (d.photos.length) {
      this.section(doc, "pdf.observations");
      const taille = (LARGEUR - 20) / 3;
      d.photos.slice(0, 9).forEach((p, i) => {
        if (i % 3 === 0) this.place(doc, taille + 20);
        const x = MARGE + (i % 3) * (taille + 10);
        const y = doc.y;
        try {
          doc.image(p.image, x, y, { fit: [taille, taille * 0.75] });
        } catch {
          /* format non pris en charge */
        }
        doc
          .font("latin")
          .fontSize(7)
          .fillColor(GRIS)
          .text(dateHeure(new Date(p.prisLe)), x, y + taille * 0.75 + 2, { width: taille });
        if (i % 3 === 2 || i === d.photos.length - 1) doc.y = y + taille * 0.75 + 14;
        else doc.y = y;
      });
    }

    this.signatures(doc, d.signatureClient, null, d.signeLe, false);
    return this.terminer(doc);
  }
}
