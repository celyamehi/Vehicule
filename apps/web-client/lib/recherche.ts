import { COMMUNES_BEJAIA, dateAlger } from "@lvb/shared";

export type ResultatRecherche = {
  id: string;
  marque: string;
  modele: string;
  annee: number;
  categorie: string;
  boite: string;
  carburant: string;
  places: number;
  options: Record<string, boolean>;
  kmInclusParJour: number | null;
  photo: string | null;
  prix: { total: number; parJour: number; jours: number; caution: number };
  agence: { id: string; raisonSociale: string; score: number; politiqueAnnulation: string };
  pointRetrait: {
    id: string;
    nom: string;
    commune: string;
    adresse: string;
    lat: number | null;
    lon: number | null;
    distanceKm: number | null;
  };
};

export type ReponseRecherche = {
  total: number;
  page: number;
  parPage: number;
  jours: number;
  resultats: ResultatRecherche[];
};

/** Dates proposées par défaut : demain 10 h → 3 jours plus tard, heure d'Alger. */
export function datesParDefaut() {
  const demain = dateAlger(new Date(Date.now() + 86_400_000));
  const retour = dateAlger(new Date(Date.now() + 4 * 86_400_000));
  return { debut: `${demain}T10:00:00+01:00`, fin: `${retour}T10:00:00+01:00` };
}

/** Pages « location voiture <ville> » (référencement, section 14.4). */
export const VILLES = [
  { slug: "bejaia", commune: "Béjaïa" },
  { slug: "akbou", commune: "Akbou" },
  { slug: "tichy", commune: "Tichy" },
  { slug: "aokas", commune: "Aokas" },
  { slug: "el-kseur", commune: "El Kseur" },
  { slug: "amizour", commune: "Amizour" },
  { slug: "sidi-aich", commune: "Sidi Aïch" },
  { slug: "kherrata", commune: "Kherrata" },
  { slug: "tazmalt", commune: "Tazmalt" },
  { slug: "souk-el-tenine", commune: "Souk El Ténine" },
] as const satisfies readonly { slug: string; commune: (typeof COMMUNES_BEJAIA)[number] }[];

/** Paramètres d'URL de recherche, validés côté client et serveur. */
export function lireParametres(sp: Record<string, string | string[] | undefined>) {
  const v = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const defaut = datesParDefaut();
  return {
    debut: v("debut") ?? defaut.debut,
    fin: v("fin") ?? defaut.fin,
    wilaya: v("wilaya") ?? "6",
    commune: v("commune"),
    categorie: v("categorie"),
    boite: v("boite"),
    carburant: v("carburant"),
    placesMin: v("placesMin"),
    climatisation: v("climatisation"),
    prixMax: v("prixMax"),
    tri: v("tri") ?? "prix",
    page: v("page") ?? "1",
  };
}

export const versRequete = (p: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => !!e[1])).toString();
