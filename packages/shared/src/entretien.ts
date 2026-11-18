/**
 * Entretien et échéances administratives (section 4.10) : calcul de la prochaine échéance
 * et des rappels (vidange par km ou date, assurance, contrôle technique, vignette, pneus…).
 */
import { anneesRevolues } from "./dates.js";

export const TYPES_ENTRETIEN = [
  "vidange",
  "assurance",
  "controle_technique",
  "vignette",
  "pneus",
  "freins",
  "revision",
  "reparation",
  "autre",
] as const;
export type TypeEntretien = (typeof TYPES_ENTRETIEN)[number];

/** Intervalles proposés par défaut (décision D37) ; l'agence peut toujours saisir sa propre échéance. */
export const INTERVALLES_ENTRETIEN: Record<TypeEntretien, { mois?: number; km?: number }> = {
  vidange: { mois: 12, km: 10_000 },
  assurance: { mois: 12 },
  controle_technique: { mois: 12 },
  vignette: { mois: 12 },
  pneus: { mois: 48, km: 40_000 },
  freins: { km: 30_000 },
  revision: { mois: 12, km: 15_000 },
  reparation: {},
  autre: {},
};

/** Seuils d'alerte « bientôt ». */
export const SEUILS_RAPPEL = { jours: 15, km: 1_000 } as const;

const MS_JOUR = 86_400_000;
const versJour = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

/** Ajoute des mois à une date calendaire AAAA-MM-JJ (fin de mois gérée). */
export function ajouterMois(date: string, mois: number): string {
  const [a, m, j] = date.split("-").map(Number) as [number, number, number];
  const cible = new Date(Date.UTC(a, m - 1 + mois, 1));
  const dernierJour = new Date(
    Date.UTC(cible.getUTCFullYear(), cible.getUTCMonth() + 1, 0),
  ).getUTCDate();
  cible.setUTCDate(Math.min(j, dernierJour));
  return cible.toISOString().slice(0, 10);
}

/** Prochaine échéance proposée après une intervention. */
export function prochaineEcheance(type: TypeEntretien, date: string, kilometrage?: number | null) {
  const i = INTERVALLES_ENTRETIEN[type];
  return {
    date: i.mois ? ajouterMois(date, i.mois) : null,
    km: i.km && kilometrage !== undefined && kilometrage !== null ? kilometrage + i.km : null,
  };
}

export type NiveauRappel = "en_retard" | "bientot" | "ok";

/** État d'une échéance : la plus urgente entre la date et le kilométrage l'emporte. */
export function etatEcheance(p: {
  echeanceDate: string | null;
  echeanceKm: number | null;
  aujourdhui: string;
  kilometrageActuel: number;
}): { niveau: NiveauRappel; joursRestants: number | null; kmRestants: number | null } {
  const joursRestants = p.echeanceDate
    ? Math.round((versJour(p.echeanceDate) - versJour(p.aujourdhui)) / MS_JOUR)
    : null;
  const kmRestants = p.echeanceKm !== null ? p.echeanceKm - p.kilometrageActuel : null;
  const enRetard =
    (joursRestants !== null && joursRestants < 0) || (kmRestants !== null && kmRestants < 0);
  const bientot =
    (joursRestants !== null && joursRestants <= SEUILS_RAPPEL.jours) ||
    (kmRestants !== null && kmRestants <= SEUILS_RAPPEL.km);
  return { niveau: enRetard ? "en_retard" : bientot ? "bientot" : "ok", joursRestants, kmRestants };
}

export type EntretienPourRappel = {
  vehiculeId: string;
  type: TypeEntretien;
  date: string;
  prochaineEcheanceDate: string | null;
  prochaineEcheanceKm: number | null;
};

export type Rappel = {
  vehiculeId: string;
  type: TypeEntretien;
  derniereFois: string;
  echeanceDate: string | null;
  echeanceKm: number | null;
  niveau: NiveauRappel;
  joursRestants: number | null;
  kmRestants: number | null;
};

/**
 * Rappels de la flotte : pour chaque véhicule et chaque type, seule la dernière intervention
 * compte. Triés du plus urgent au moins urgent.
 */
export function calculerRappels(
  entretiens: EntretienPourRappel[],
  vehicules: { id: string; kilometrage: number }[],
  aujourdhui: string,
): Rappel[] {
  const km = new Map(vehicules.map((v) => [v.id, v.kilometrage]));
  const derniers = new Map<string, EntretienPourRappel>();
  for (const e of entretiens) {
    if (!km.has(e.vehiculeId)) continue;
    const cle = `${e.vehiculeId}:${e.type}`;
    const actuel = derniers.get(cle);
    if (!actuel || e.date > actuel.date) derniers.set(cle, e);
  }
  const ordre: Record<NiveauRappel, number> = { en_retard: 0, bientot: 1, ok: 2 };
  return [...derniers.values()]
    .filter((e) => e.prochaineEcheanceDate || e.prochaineEcheanceKm !== null)
    .map((e) => {
      const etat = etatEcheance({
        echeanceDate: e.prochaineEcheanceDate,
        echeanceKm: e.prochaineEcheanceKm,
        aujourdhui,
        kilometrageActuel: km.get(e.vehiculeId)!,
      });
      return {
        vehiculeId: e.vehiculeId,
        type: e.type,
        derniereFois: e.date,
        echeanceDate: e.prochaineEcheanceDate,
        echeanceKm: e.prochaineEcheanceKm,
        ...etat,
      };
    })
    .sort(
      (a, b) =>
        ordre[a.niveau] - ordre[b.niveau] ||
        (a.joursRestants ?? Infinity) - (b.joursRestants ?? Infinity) ||
        (a.kmRestants ?? Infinity) - (b.kmRestants ?? Infinity),
    );
}

/** Rentabilité d'un véhicule : revenus des locations moins coûts d'entretien. */
export function rentabilite(revenus: number, couts: number, depuis?: string, jusqua?: string) {
  const marge = revenus - couts;
  return {
    revenus,
    couts,
    marge,
    tauxMarge: revenus > 0 ? Math.round((marge / revenus) * 1000) / 10 : null,
    annees: depuis && jusqua ? Math.max(0, anneesRevolues(depuis, jusqua)) : undefined,
  };
}
