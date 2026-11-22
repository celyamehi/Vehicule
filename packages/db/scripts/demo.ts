/**
 * Scénario de test complet (base de développement uniquement), à lancer après `db:seed`.
 * Relançable : les données de démonstration précédentes sont remplacées.
 *
 * Comptes de test (code SMS fixe 123456 en développement, voir OTP_CODE_TEST dans .env) :
 *   - cliente « Amel Test »   : +213550000010 — location terminée (avis à laisser), réservation à venir avec messages
 *   - client « Yanis Test »   : +213550000011 — demande en ligne à accepter, location en cours
 */
import "./env.js";
import { and, eq, inArray, like } from "drizzle-orm";
import { creerBase } from "../src/client.js";
import * as s from "../src/schema.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant dans .env");
if (/_test(\?|$)/.test(url))
  throw new Error("Le scénario de démonstration ne se lance pas sur la base de test");
const { db, fermer } = creerBase(url, { max: 1 });

const JOUR = 86_400_000;
const maintenant = Date.now();
const date = (decalageJours: number, heure = 10) => {
  const d = new Date(maintenant + decalageJours * JOUR);
  d.setUTCHours(heure - 1, 0, 0, 0); // heure d'Alger (UTC+1)
  return d;
};
const jourCalendaire = (decalageJours: number) =>
  new Date(maintenant + decalageJours * JOUR).toISOString().slice(0, 10);

async function utilisateur(
  telephone: string,
  prenom: string,
  nom: string,
  dateNaissance: string,
  langue: "fr" | "ar" | "kab",
) {
  const valeurs = { prenom, nom, dateNaissance, langue, consentementLe: new Date() };
  const [u] = await db
    .insert(s.utilisateurs)
    .values({ telephone, ...valeurs })
    .onConflictDoUpdate({ target: s.utilisateurs.telephone, set: valeurs })
    .returning();
  const [permis] = await db
    .select({ id: s.documentsIdentite.id })
    .from(s.documentsIdentite)
    .where(
      and(eq(s.documentsIdentite.utilisateurId, u!.id), eq(s.documentsIdentite.type, "permis")),
    );
  if (!permis)
    await db.insert(s.documentsIdentite).values({
      utilisateurId: u!.id,
      type: "permis",
      numero: `TEST-${telephone.slice(-4)}`,
      dateDelivrance: "2014-06-01",
      dateExpiration: "2034-06-01",
      statutVerification: "verifie",
    });
  return u!;
}

try {
  const [agence] = await db.select().from(s.agences).where(eq(s.agences.nif, "000616000000001"));
  if (!agence)
    throw new Error(
      "Agence de démonstration introuvable : lancez d'abord `pnpm --filter @lvb/db db:seed`",
    );
  const [gerant] = await db
    .select()
    .from(s.utilisateurs)
    .where(eq(s.utilisateurs.telephone, "+213550000002"));
  const flotte = await db.select().from(s.vehicules).where(eq(s.vehicules.agenceId, agence.id));
  const v = (immat: string) => {
    const x = flotte.find((f) => f.immatriculation === immat);
    if (!x) throw new Error(`Véhicule ${immat} introuvable`);
    return x;
  };
  const clio = v("01234-123-06");
  const logan = v("01236-121-06");
  const p308 = v("01237-123-06");
  const tucson = v("01238-122-06");
  const kangoo = v("01239-121-06");

  const amel = await utilisateur("+213550000010", "Amel", "Test", "1993-05-14", "fr");
  const yanis = await utilisateur("+213550000011", "Yanis", "Test", "1988-11-02", "kab");
  for (const c of [amel, yanis])
    await db
      .insert(s.clientsAgence)
      .values({ agenceId: agence.id, utilisateurId: c.id })
      .onConflictDoNothing();

  // Nettoyage des données de démonstration précédentes.
  const anciennes = await db
    .select({ id: s.reservations.id })
    .from(s.reservations)
    .where(like(s.reservations.code, "DEMO-%"));
  if (anciennes.length) {
    await db.delete(s.amendes).where(
      inArray(
        s.amendes.reservationId,
        anciennes.map((r) => r.id),
      ),
    );
    // Les encaissements ne sont pas supprimés en cascade (traçabilité) : on les retire d'abord.
    await db.delete(s.paiements).where(
      inArray(
        s.paiements.reservationId,
        anciennes.map((r) => r.id),
      ),
    );
    await db.delete(s.reservations).where(
      inArray(
        s.reservations.id,
        anciennes.map((r) => r.id),
      ),
    );
  }
  await db
    .delete(s.amendes)
    .where(and(eq(s.amendes.agenceId, agence.id), like(s.amendes.reference, "DEMO-%")));
  await db
    .delete(s.entretiens)
    .where(and(eq(s.entretiens.agenceId, agence.id), like(s.entretiens.notes, "[démo]%")));
  await db
    .delete(s.depenses)
    .where(and(eq(s.depenses.agenceId, agence.id), like(s.depenses.notes, "[démo]%")));

  const detail = (prixJour: number, jours: number, caution: number) => ({
    jours,
    prixJourApplique: prixJour,
    sousTotalLocation: prixJour * jours,
    options: [],
    fraisLivraison: 0,
    remise: 0,
    total: prixJour * jours,
    caution,
  });
  const conditions = {
    ageMinimum: 21,
    ancienneteMinPermisAnnees: 2,
    kmInclusParJour: 250,
    politiqueAnnulation: "moderee" as const,
  };
  const base = {
    agenceId: agence.id,
    battementMinutes: agence.battementMinutes,
    politiqueAnnulation: agence.politiqueAnnulation,
    conditions,
    creePar: gerant?.id ?? null,
  };
  const inserer = async (
    valeurs: Omit<
      typeof s.reservations.$inferInsert,
      "agenceId" | "battementMinutes" | "politiqueAnnulation"
    >,
  ) => {
    const [r] = await db
      .insert(s.reservations)
      .values({
        ...base,
        // Une demande est confirmée après sa création : on la date 25 min avant la confirmation.
        ...(valeurs.confirmeeLe
          ? { createdAt: new Date(new Date(valeurs.confirmeeLe).getTime() - 25 * 60_000) }
          : {}),
        ...valeurs,
      })
      .returning();
    return r!;
  };

  // 1. Location terminée hier (Amel) : elle peut laisser un avis ; une amende pendant la location.
  const terminee = await inserer({
    code: "DEMO-TERMINE",
    vehiculeId: clio.id,
    clientId: amel.id,
    pointRetraitDepartId: clio.pointRetraitId,
    pointRetraitRetourId: clio.pointRetraitId,
    debut: date(-4),
    fin: date(-1),
    origine: "plateforme",
    statut: "terminee",
    prixTotal: 13_500,
    detailPrix: detail(4_500, 3, 30_000),
    caution: 30_000,
    confirmeeLe: date(-6),
    departLe: date(-4),
    retourLe: date(-1, 11),
  });
  await db.insert(s.etatsDesLieux).values([
    {
      agenceId: agence.id,
      reservationId: terminee.id,
      moment: "depart",
      kilometrage: 20_000,
      carburant: 8,
      signeLe: date(-4),
      signePar: gerant?.id ?? null,
    },
    {
      agenceId: agence.id,
      reservationId: terminee.id,
      moment: "retour",
      kilometrage: 20_640,
      carburant: 7,
      signeLe: date(-1, 11),
      signePar: gerant?.id ?? null,
    },
  ]);
  await db
    .insert(s.paiements)
    .values({
      agenceId: agence.id,
      reservationId: terminee.id,
      type: "solde",
      moyen: "especes",
      montant: 13_500,
      statut: "reussi",
      enregistrePar: gerant?.id ?? null,
    });
  await db.insert(s.amendes).values({
    agenceId: agence.id,
    vehiculeId: clio.id,
    reservationId: terminee.id,
    clientId: amel.id,
    dateInfraction: date(-3, 15),
    montant: 2_000,
    motif: "Excès de vitesse",
    lieu: "RN 9, Aokas",
    reference: "DEMO-PV-0001",
    creePar: gerant?.id ?? null,
  });

  // 2. Réservation confirmée dans 3 jours (Amel), avec une conversation.
  const avenir = await inserer({
    code: "DEMO-AVENIR",
    vehiculeId: p308.id,
    clientId: amel.id,
    pointRetraitDepartId: p308.pointRetraitId,
    pointRetraitRetourId: p308.pointRetraitId,
    debut: date(3),
    fin: date(6),
    origine: "plateforme",
    statut: "confirmee",
    prixTotal: 22_500 + 2_000,
    detailPrix: { ...detail(7_500, 3, 60_000), fraisLivraison: 2_000, total: 24_500 },
    caution: 60_000,
    confirmeeLe: new Date(maintenant - 3_600_000),
    livraison: {
      adresse: "Hôtel Les Hammadites, route de Tichy",
      commune: "Tichy",
      recuperation: true,
    },
  });
  await db.insert(s.messages).values([
    {
      agenceId: agence.id,
      reservationId: avenir.id,
      auteurId: amel.id,
      auteur: "client",
      texte: "Bonjour, pouvez-vous livrer la voiture à 9 h à l'hôtel ?",
      createdAt: new Date(maintenant - 3_000_000),
    },
    {
      agenceId: agence.id,
      reservationId: avenir.id,
      auteurId: gerant?.id ?? amel.id,
      auteur: "agence",
      texte: "Bonjour Amel, oui, notre chauffeur sera à la réception à 9 h.",
      createdAt: new Date(maintenant - 2_400_000),
      luLe: new Date(),
    },
  ]);

  // 3. Demande en ligne en attente (Yanis) : à accepter ou refuser dans le logiciel.
  await inserer({
    code: "DEMO-DEMANDE",
    vehiculeId: tucson.id,
    clientId: yanis.id,
    pointRetraitDepartId: tucson.pointRetraitId,
    pointRetraitRetourId: tucson.pointRetraitId,
    debut: date(5),
    fin: date(9),
    origine: "plateforme",
    statut: "en_attente_agence",
    prixTotal: 44_000,
    detailPrix: detail(11_000, 4, 100_000),
    caution: 100_000,
    expireLe: new Date(maintenant + 110 * 60_000),
  });

  // 4. Location en cours (Yanis), retour dans 2 jours.
  const enCours = await inserer({
    code: "DEMO-ENCOURS",
    vehiculeId: logan.id,
    clientId: yanis.id,
    pointRetraitDepartId: logan.pointRetraitId,
    pointRetraitRetourId: logan.pointRetraitId,
    debut: date(-1),
    fin: date(2),
    origine: "comptoir",
    statut: "en_cours",
    prixTotal: 15_000,
    detailPrix: detail(5_000, 3, 40_000),
    caution: 40_000,
    confirmeeLe: date(-1),
    departLe: date(-1),
  });
  await db
    .insert(s.etatsDesLieux)
    .values({
      agenceId: agence.id,
      reservationId: enCours.id,
      moment: "depart",
      kilometrage: 35_000,
      carburant: 8,
      signeLe: date(-1),
      signePar: gerant?.id ?? null,
    });
  await db.update(s.vehicules).set({ statut: "loue" }).where(eq(s.vehicules.id, logan.id));

  // 5. Ancienne location (Yanis) avec un avis publié, pour voir les étoiles sur le site.
  const ancienne = await inserer({
    code: "DEMO-AVIS",
    vehiculeId: kangoo.id,
    clientId: yanis.id,
    pointRetraitDepartId: kangoo.pointRetraitId,
    pointRetraitRetourId: kangoo.pointRetraitId,
    debut: date(-20),
    fin: date(-18),
    origine: "plateforme",
    statut: "terminee",
    prixTotal: 12_000,
    detailPrix: detail(6_000, 2, 50_000),
    caution: 50_000,
    confirmeeLe: date(-22),
    departLe: date(-20),
    retourLe: date(-18),
  });
  await db.insert(s.avis).values({
    agenceId: agence.id,
    reservationId: ancienne.id,
    vehiculeId: kangoo.id,
    auteurId: yanis.id,
    note: 5,
    commentaire: "Utilitaire propre et ponctuel, idéal pour mon déménagement. Merci !",
    reponseAgence: "Merci Yanis, au plaisir de vous revoir.",
    reponduLe: date(-17),
  });

  // 6. Entretiens : une vidange presque due, une assurance qui expire bientôt, un contrôle technique dépassé.
  const notes = "[démo] données de test";
  await db.insert(s.entretiens).values([
    {
      agenceId: agence.id,
      vehiculeId: clio.id,
      type: "vidange",
      date: jourCalendaire(-330),
      kilometrage: 10_900,
      cout: 6_500,
      prochaineEcheanceDate: jourCalendaire(35),
      prochaineEcheanceKm: 20_900,
      prestataire: "Garage Soummam",
      notes,
    },
    {
      agenceId: agence.id,
      vehiculeId: tucson.id,
      type: "assurance",
      date: jourCalendaire(-355),
      cout: 52_000,
      prochaineEcheanceDate: jourCalendaire(10),
      notes,
    },
    {
      agenceId: agence.id,
      vehiculeId: kangoo.id,
      type: "controle_technique",
      date: jourCalendaire(-370),
      cout: 3_500,
      prochaineEcheanceDate: jourCalendaire(-5),
      notes,
    },
    {
      agenceId: agence.id,
      vehiculeId: p308.id,
      type: "pneus",
      date: jourCalendaire(-120),
      kilometrage: 15_000,
      cout: 48_000,
      prochaineEcheanceKm: 55_000,
      notes,
    },
  ]);

  // Caisse : caution encaissée puis restituée sur la location terminée, et quelques dépenses.
  await db.insert(s.paiements).values([
    {
      agenceId: agence.id,
      reservationId: terminee.id,
      type: "caution",
      moyen: "especes",
      montant: 30_000,
      statut: "reussi",
      enregistrePar: gerant?.id ?? null,
    },
    {
      agenceId: agence.id,
      reservationId: terminee.id,
      type: "restitution_caution",
      moyen: "especes",
      montant: 30_000,
      statut: "reussi",
      enregistrePar: gerant?.id ?? null,
    },
  ]);
  await db.insert(s.depenses).values([
    {
      agenceId: agence.id,
      vehiculeId: clio.id,
      categorie: "pneus",
      libelle: "Pneu avant droit",
      montant: 9_500,
      date: jourCalendaire(-1),
      moyen: "especes",
      notes,
      creePar: gerant?.id ?? null,
    },
    {
      agenceId: agence.id,
      vehiculeId: tucson.id,
      categorie: "carburant",
      libelle: "Plein avant départ",
      montant: 6_000,
      date: jourCalendaire(0),
      moyen: "especes",
      notes,
      creePar: gerant?.id ?? null,
    },
    {
      agenceId: agence.id,
      vehiculeId: null,
      categorie: "lavage",
      libelle: "Lavage de trois véhicules",
      montant: 2_400,
      date: jourCalendaire(0),
      moyen: "especes",
      notes,
      creePar: gerant?.id ?? null,
    },
    {
      agenceId: agence.id,
      vehiculeId: null,
      categorie: "loyer",
      libelle: "Loyer du local",
      montant: 45_000,
      date: jourCalendaire(-2),
      moyen: "virement",
      notes,
      creePar: gerant?.id ?? null,
    },
  ]);

  console.log("Scénario de démonstration prêt :");
  console.log(
    "  Amel Test  +213550000010 : DEMO-TERMINE (avis à laisser, amende), DEMO-AVENIR (messages, livraison)",
  );
  console.log(
    "  Yanis Test +213550000011 : DEMO-DEMANDE (à accepter), DEMO-ENCOURS (retour à faire), DEMO-AVIS (avis 5 étoiles)",
  );
} finally {
  await fermer();
}
