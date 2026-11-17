import "../scripts/env.js";
import { sql as dsql } from "drizzle-orm";
import { creerBase } from "../src/client.js";
import * as s from "../src/schema.js";

export function baseDeTest(max = 10) {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("DATABASE_URL_TEST manquant");
  return creerBase(url, { max });
}

type Db = ReturnType<typeof baseDeTest>["db"];

let compteur = 0;
const unique = () => `${Date.now().toString(36)}${(compteur++).toString(36)}`;

/** Crée une agence avec un point de retrait, une catégorie, un véhicule et un client. */
export async function creerJeuDeDonnees(db: Db, options: { battementMinutes?: number } = {}) {
  const u = unique();
  const [agence] = await db
    .insert(s.agences)
    .values({
      raisonSociale: `Agence ${u}`,
      nif: `NIF${u}`,
      registreCommerce: `RC${u}`,
      wilaya: 6,
      adresse: "Rue de la Liberté, Béjaïa",
      telephone: "+213550000000",
      battementMinutes: options.battementMinutes ?? 120,
    })
    .returning();
  const [point] = await db
    .insert(s.pointsRetrait)
    .values({
      agenceId: agence!.id,
      nom: "Centre",
      adresse: "Centre-ville",
      wilaya: 6,
      commune: "Béjaïa",
      position:
        dsql`ST_SetSRID(ST_MakePoint(5.0843, 36.7509), 4326)::geography` as unknown as string,
    })
    .returning();
  const [categorie] = await db
    .insert(s.categoriesVehicule)
    .values({ code: `cat_${u}`, libelles: { fr: "Citadine", ar: "سيارة مدينة", kab: "Citadine" } })
    .returning();
  const creerVehicule = async () => {
    const [v] = await db
      .insert(s.vehicules)
      .values({
        agenceId: agence!.id,
        pointRetraitId: point!.id,
        categorieId: categorie!.id,
        marque: "Renault",
        modele: "Clio",
        annee: 2022,
        immatriculation: `${unique()}-06`,
        boite: "manuelle",
        carburant: "essence",
        places: 5,
      })
      .returning();
    return v!;
  };
  const vehicule = await creerVehicule();
  const [client] = await db
    .insert(s.utilisateurs)
    .values({ telephone: `+21355${Math.floor(1e7 + Math.random() * 8.9e7)}` })
    .returning();
  return {
    agence: agence!,
    point: point!,
    categorie: categorie!,
    vehicule,
    client: client!,
    creerVehicule,
  };
}

/** Date en Africa/Algiers (UTC+1, pas d'heure d'été). */
export const alger = (iso: string) => new Date(`${iso}+01:00`);

export function valeursReservation(
  jeu: Awaited<ReturnType<typeof creerJeuDeDonnees>>,
  debut: string,
  fin: string,
  extra: Partial<typeof s.reservations.$inferInsert> = {},
): typeof s.reservations.$inferInsert {
  return {
    code: `T-${unique()}`,
    agenceId: jeu.agence.id,
    vehiculeId: jeu.vehicule.id,
    clientId: jeu.client.id,
    debut: alger(debut),
    fin: alger(fin),
    battementMinutes: jeu.agence.battementMinutes,
    origine: "comptoir",
    statut: "confirmee",
    politiqueAnnulation: "moderee",
    prixTotal: 10_000,
    ...extra,
  };
}
