/**
 * Données de référence et de démonstration (base de dev uniquement).
 * Idempotent : peut être relancé sans créer de doublons.
 *
 * Comptes de démonstration (connexion par OTP ; en dev le code s'affiche dans les logs de l'API) :
 *   - administrateur plateforme : +213550000001
 *   - gérant de l'agence démo   : +213550000002
 *   - employé de l'agence démo  : +213550000004
 *   - client                    : +213550000003
 */
import "./env.js";
import { and, eq, sql } from "drizzle-orm";
import { creerBase } from "../src/client.js";
import * as s from "../src/schema.js";

/** Libellés des catégories. Kabyle à faire relire par un locuteur natif (voir DECISIONS.md). */
export const CATEGORIES = [
  {
    code: "citadine",
    ordre: 1,
    libelles: { fr: "Citadine", ar: "سيارة مدينة", kab: "Takeṛṛust n temdint", en: "City car" },
  },
  {
    code: "berline",
    ordre: 2,
    libelles: { fr: "Berline", ar: "سيدان", kab: "Takeṛṛust tameqqrant", en: "Sedan" },
  },
  {
    code: "suv",
    ordre: 3,
    libelles: { fr: "SUV", ar: "سيارة رباعية الدفع", kab: "SUV", en: "SUV" },
  },
  {
    code: "utilitaire",
    ordre: 4,
    libelles: { fr: "Utilitaire", ar: "سيارة نفعية", kab: "Takeṛṛust n uxeddim", en: "Van" },
  },
  {
    code: "minibus",
    ordre: 5,
    libelles: { fr: "Minibus", ar: "حافلة صغيرة", kab: "Minibus", en: "Minibus" },
  },
] as const;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquant dans .env");
const { db, fermer } = creerBase(url, { max: 1 });

async function utilisateur(
  telephone: string,
  valeurs: Partial<typeof s.utilisateurs.$inferInsert>,
) {
  const [u] = await db
    .insert(s.utilisateurs)
    .values({ telephone, consentementLe: new Date(), ...valeurs })
    .onConflictDoUpdate({ target: s.utilisateurs.telephone, set: valeurs })
    .returning();
  return u!;
}

try {
  // 1. Catégories
  for (const c of CATEGORIES) {
    await db
      .insert(s.categoriesVehicule)
      .values(c)
      .onConflictDoUpdate({
        target: s.categoriesVehicule.code,
        set: { libelles: c.libelles, ordre: c.ordre },
      });
  }
  const categories = Object.fromEntries(
    (await db.select().from(s.categoriesVehicule)).map((c) => [c.code, c.id]),
  );

  // 2. Comptes
  await utilisateur("+213550000001", {
    nom: "Admin",
    prenom: "Plateforme",
    rolePlateforme: "admin",
  });
  const gerant = await utilisateur("+213550000002", {
    nom: "Amrani",
    prenom: "Karim",
    langue: "fr",
  });
  const employe = await utilisateur("+213550000004", {
    nom: "Mansouri",
    prenom: "Lynda",
    langue: "fr",
  });
  await utilisateur("+213550000003", {
    nom: "Haddad",
    prenom: "Sofiane",
    langue: "kab",
    dateNaissance: "1990-04-12",
  });

  // 3. Agence de démonstration (validée, donc visible sur le site)
  let [agence] = await db.select().from(s.agences).where(eq(s.agences.nif, "000616000000001"));
  if (!agence) {
    [agence] = await db
      .insert(s.agences)
      .values({
        raisonSociale: "Yemma Gouraya Location",
        nif: "000616000000001",
        registreCommerce: "06/00-1234567B21",
        agrement: "AGR-06-2021-015",
        wilaya: 6,
        adresse: "12, boulevard Amirouche, Béjaïa",
        telephone: "+213034000000",
        email: "contact@exemple.dz",
        statut: "validee",
        valideeLe: new Date(),
        confirmationInstantanee: false,
        politiqueAnnulation: "moderee",
      })
      .returning();
  }
  const agenceId = agence!.id;

  await db
    .insert(s.membresAgence)
    .values([
      { agenceId, utilisateurId: gerant.id, role: "gerant" },
      {
        agenceId,
        utilisateurId: employe.id,
        role: "employe",
        permissions: ["reservations.creer", "reservations.depart_retour", "etats_des_lieux"],
      },
    ])
    .onConflictDoNothing();

  // 4. Points de retrait
  const points = [
    {
      nom: "Agence centre",
      adresse: "12, boulevard Amirouche",
      commune: "Béjaïa",
      lon: 5.0843,
      lat: 36.7509,
    },
    {
      nom: "Aéroport Abane-Ramdane",
      adresse: "Aéroport de Béjaïa – Soummam",
      commune: "Béjaïa",
      lon: 5.0699,
      lat: 36.712,
    },
    {
      nom: "Gare de Béjaïa",
      adresse: "Place de la gare",
      commune: "Béjaïa",
      lon: 5.0897,
      lat: 36.7535,
    },
  ];
  const pointIds: string[] = [];
  for (const p of points) {
    let [existant] = await db
      .select()
      .from(s.pointsRetrait)
      .where(and(eq(s.pointsRetrait.agenceId, agenceId), eq(s.pointsRetrait.nom, p.nom)));
    if (!existant) {
      [existant] = await db
        .insert(s.pointsRetrait)
        .values({
          agenceId,
          nom: p.nom,
          adresse: p.adresse,
          wilaya: 6,
          commune: p.commune,
          position:
            sql`ST_SetSRID(ST_MakePoint(${p.lon}, ${p.lat}), 4326)::geography` as unknown as string,
          horaires: Object.fromEntries(
            ["sam", "dim", "lun", "mar", "mer", "jeu"].map((j) => [j, [["08:00", "19:00"]]]),
          ),
        })
        .returning();
    }
    pointIds.push(existant!.id);
  }

  // 5. Véhicules et tarifs
  const flotte = [
    {
      marque: "Renault",
      modele: "Clio 5",
      annee: 2023,
      immat: "01234-123-06",
      cat: "citadine",
      boite: "manuelle",
      carb: "essence",
      places: 5,
      prix: 4500,
      caution: 30000,
    },
    {
      marque: "Hyundai",
      modele: "i10",
      annee: 2022,
      immat: "01235-122-06",
      cat: "citadine",
      boite: "manuelle",
      carb: "essence",
      places: 5,
      prix: 3800,
      caution: 25000,
    },
    {
      marque: "Dacia",
      modele: "Logan",
      annee: 2021,
      immat: "01236-121-06",
      cat: "berline",
      boite: "manuelle",
      carb: "diesel",
      places: 5,
      prix: 5000,
      caution: 40000,
    },
    {
      marque: "Peugeot",
      modele: "308",
      annee: 2023,
      immat: "01237-123-06",
      cat: "berline",
      boite: "automatique",
      carb: "diesel",
      places: 5,
      prix: 7500,
      caution: 60000,
    },
    {
      marque: "Hyundai",
      modele: "Tucson",
      annee: 2022,
      immat: "01238-122-06",
      cat: "suv",
      boite: "automatique",
      carb: "diesel",
      places: 5,
      prix: 11000,
      caution: 100000,
    },
    {
      marque: "Renault",
      modele: "Kangoo",
      annee: 2021,
      immat: "01239-121-06",
      cat: "utilitaire",
      boite: "manuelle",
      carb: "diesel",
      places: 2,
      prix: 6000,
      caution: 50000,
    },
  ] as const;

  for (const [i, v] of flotte.entries()) {
    let [vehicule] = await db
      .select()
      .from(s.vehicules)
      .where(and(eq(s.vehicules.agenceId, agenceId), eq(s.vehicules.immatriculation, v.immat)));
    if (!vehicule) {
      [vehicule] = await db
        .insert(s.vehicules)
        .values({
          agenceId,
          pointRetraitId: pointIds[i % 2]!,
          categorieId: categories[v.cat]!,
          marque: v.marque,
          modele: v.modele,
          annee: v.annee,
          immatriculation: v.immat,
          boite: v.boite,
          carburant: v.carb,
          places: v.places,
          kilometrage: 20000 + i * 7500,
          kmInclusParJour: 250,
          options: {
            climatisation: true,
            gps: i % 2 === 0,
            siegeBebe: true,
            conducteurAdditionnel: true,
          },
        })
        .returning();
      await db.insert(s.tarifs).values({
        agenceId,
        vehiculeId: vehicule!.id,
        libelle: "Tarif de base",
        prixJour: v.prix,
        paliers: [
          { aPartirDeJours: 7, prixJour: Math.round((v.prix * 0.9) / 100) * 100 },
          { aPartirDeJours: 30, prixJour: Math.round((v.prix * 0.75) / 100) * 100 },
        ],
        supplements: {
          siegeBebe: { parJour: 500 },
          gps: { parJour: 400 },
          conducteurAdditionnel: { forfait: 1500 },
          livraison: { forfait: 2000 },
        },
        caution: v.caution,
      });
    }
  }

  console.log(
    `Seed terminé : ${CATEGORIES.length} catégories, agence « ${agence!.raisonSociale} », ${flotte.length} véhicules.`,
  );
} finally {
  await fermer();
}
