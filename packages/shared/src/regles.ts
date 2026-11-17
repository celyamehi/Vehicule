/**
 * Règles métier pures de la section 6 (sans accès base) : statuts, prix, annulation,
 * conditions conducteur. Utilisées par l'API et affichées par les interfaces.
 */
import {
  DELAIS,
  type OptionReservable,
  type PolitiqueAnnulation,
  type StatutReservation,
} from "./constantes.js";
import { MS_HEURE, MS_JOUR, ageEnAnnees, anneesRevolues, dateAlger } from "./dates.js";

// ---------------------------------------------------------------------------
// 6.2 Statuts d'une réservation
// ---------------------------------------------------------------------------

/** Statuts qui bloquent le véhicule (même liste que la contrainte SQL `pas_de_chevauchement`). */
export const STATUTS_BLOQUANTS = [
  "en_attente_paiement",
  "en_attente_agence",
  "confirmee",
  "en_cours",
] as const satisfies readonly StatutReservation[];

export const estBloquant = (statut: StatutReservation) =>
  (STATUTS_BLOQUANTS as readonly StatutReservation[]).includes(statut);

/** Transitions autorisées (tableau 6.2). */
export const TRANSITIONS: Record<StatutReservation, readonly StatutReservation[]> = {
  // Après paiement : vers l'agence, ou directement confirmée si l'agence a la confirmation instantanée.
  en_attente_paiement: ["en_attente_agence", "confirmee", "expiree", "annulee_client"],
  en_attente_agence: ["confirmee", "refusee", "expiree", "annulee_client"],
  confirmee: ["en_cours", "annulee_client", "annulee_agence", "non_presentation"],
  en_cours: ["terminee"],
  terminee: ["litige"],
  refusee: [],
  expiree: [],
  annulee_client: [],
  annulee_agence: [],
  non_presentation: [],
  litige: [],
};

export const transitionAutorisee = (de: StatutReservation, vers: StatutReservation) =>
  TRANSITIONS[de].includes(vers);

/** Statut initial selon l'origine (6.2 et décision D3 : paiement sur place en Phase 1). */
export function statutInitial(params: {
  origine: "plateforme" | "comptoir" | "telephone" | "blocage";
  paiementEnLigne: boolean;
  confirmationInstantanee: boolean;
  departImmediat?: boolean;
}): StatutReservation {
  if (params.origine === "blocage") return "confirmee";
  if (params.origine !== "plateforme") return params.departImmediat ? "en_cours" : "confirmee";
  if (params.paiementEnLigne) return "en_attente_paiement";
  return params.confirmationInstantanee ? "confirmee" : "en_attente_agence";
}

/** Échéance d'expiration d'un statut en attente (règle 6.3.3). */
export function echeanceExpiration(statut: StatutReservation, maintenant: Date): Date | null {
  if (statut === "en_attente_paiement")
    return new Date(maintenant.getTime() + DELAIS.paiementMinutes * 60_000);
  if (statut === "en_attente_agence")
    return new Date(maintenant.getTime() + DELAIS.confirmationAgenceMinutes * 60_000);
  return null;
}

/** Un litige peut être ouvert jusqu'à 72 h après le retour. */
export const litigePossible = (retourLe: Date, maintenant: Date) =>
  maintenant.getTime() - retourLe.getTime() <= DELAIS.litigeApresRetourHeures * MS_HEURE;

// ---------------------------------------------------------------------------
// Durée et prix (3.3, 4.8, règle 6.3.6)
// ---------------------------------------------------------------------------

/** Tolérance de retour avant de compter un jour de plus (décision D19). */
export const TOLERANCE_RETOUR_MINUTES = 59;

/** Nombre de jours facturés : tranches de 24 h entamées, au-delà d'une tolérance de 59 min. */
export function joursFactures(debut: Date, fin: Date): number {
  const duree = fin.getTime() - debut.getTime();
  if (duree <= 0) throw new RangeError("La fin doit être après le début");
  return Math.max(1, Math.ceil((duree - TOLERANCE_RETOUR_MINUTES * 60_000) / MS_JOUR));
}

export type PalierTarif = { aPartirDeJours: number; prixJour: number };
export type SupplementsTarif = Record<string, { parJour?: number; forfait?: number }>;

export type TarifPourCalcul = {
  id: string;
  /** Tarif propre au véhicule (prioritaire) ou à sa catégorie. */
  vehiculeId: string | null;
  categorieId: string | null;
  prixJour: number;
  paliers: PalierTarif[];
  supplements: SupplementsTarif;
  saisonDebut: string | null;
  saisonFin: string | null;
  caution: number;
  actif?: boolean;
};

export type DetailPrix = {
  jours: number;
  prixJourApplique: number;
  sousTotalLocation: number;
  options: { code: string; montant: number }[];
  fraisLivraison: number;
  remise: number;
  total: number;
  caution: number;
  tarifId?: string;
};

export class ErreurTarif extends Error {
  constructor(
    public readonly code: "TARIF_INTROUVABLE" | "OPTION_INDISPONIBLE",
    public readonly details: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

/**
 * Choisit le tarif applicable : tarif du véhicule avant celui de la catégorie, tarif de saison
 * (date de départ à Alger comprise dans la saison) avant le tarif de base.
 */
export function choisirTarif(tarifs: TarifPourCalcul[], debut: Date): TarifPourCalcul {
  const jour = dateAlger(debut);
  const actifs = tarifs.filter((t) => t.actif !== false);
  const score = (t: TarifPourCalcul) =>
    (t.vehiculeId ? 2 : 0) + (t.saisonDebut && t.saisonFin ? 1 : 0);
  const candidats = actifs
    .filter((t) => !t.saisonDebut || !t.saisonFin || (t.saisonDebut <= jour && jour <= t.saisonFin))
    .sort((a, b) => score(b) - score(a));
  const tarif = candidats[0];
  if (!tarif) throw new ErreurTarif("TARIF_INTROUVABLE");
  return tarif;
}

/** Prix par jour selon les paliers dégressifs (le palier le plus élevé atteint s'applique). */
export function prixJourDegressif(
  tarif: Pick<TarifPourCalcul, "prixJour" | "paliers">,
  jours: number,
) {
  const palier = [...tarif.paliers]
    .filter((p) => p.aPartirDeJours <= jours)
    .sort((a, b) => b.aPartirDeJours - a.aPartirDeJours)[0];
  return palier ? Math.min(palier.prixJour, tarif.prixJour) : tarif.prixJour;
}

/** Calcule le prix total détaillé d'une location. Tous les montants sont des entiers en DZD. */
export function calculerPrix(params: {
  debut: Date;
  fin: Date;
  tarifs: TarifPourCalcul[];
  options?: readonly OptionReservable[];
  livraison?: boolean;
  remise?: number;
}): DetailPrix {
  const tarif = choisirTarif(params.tarifs, params.debut);
  const jours = joursFactures(params.debut, params.fin);
  const prixJourApplique = prixJourDegressif(tarif, jours);
  const sousTotalLocation = prixJourApplique * jours;

  const montantSupplement = (code: string) => {
    const s = tarif.supplements[code];
    if (!s) throw new ErreurTarif("OPTION_INDISPONIBLE", { option: code });
    return Math.round((s.parJour ?? 0) * jours + (s.forfait ?? 0));
  };
  const options = [...new Set(params.options ?? [])].map((code) => ({
    code,
    montant: montantSupplement(code),
  }));
  const fraisLivraison = params.livraison ? montantSupplement("livraison") : 0;
  const brut = sousTotalLocation + options.reduce((s, o) => s + o.montant, 0) + fraisLivraison;
  const remise = Math.min(Math.max(0, Math.round(params.remise ?? 0)), brut);

  return {
    jours,
    prixJourApplique,
    sousTotalLocation,
    options,
    fraisLivraison,
    remise,
    total: brut - remise,
    caution: tarif.caution,
    tarifId: tarif.id,
  };
}

// ---------------------------------------------------------------------------
// 6.3.4 / 6.3.5 Annulation
// ---------------------------------------------------------------------------

/**
 * Barèmes de remboursement (décision D20) : pour chaque politique, paliers « au moins N heures
 * avant le départ → X % remboursés », du plus favorable au moins favorable.
 */
export const BAREMES_ANNULATION: Record<
  PolitiqueAnnulation,
  readonly { heuresAvantDepartMin: number; pourcentage: number }[]
> = {
  souple: [
    { heuresAvantDepartMin: 24, pourcentage: 100 },
    { heuresAvantDepartMin: 0, pourcentage: 50 },
  ],
  moderee: [
    { heuresAvantDepartMin: 72, pourcentage: 100 },
    { heuresAvantDepartMin: 24, pourcentage: 50 },
    { heuresAvantDepartMin: 0, pourcentage: 0 },
  ],
  stricte: [
    { heuresAvantDepartMin: 168, pourcentage: 100 },
    { heuresAvantDepartMin: 72, pourcentage: 50 },
    { heuresAvantDepartMin: 0, pourcentage: 0 },
  ],
};

/**
 * Montant remboursé au client selon qui annule et quand.
 * - Annulation par l'agence : remboursement intégral (règle 6.3.5).
 * - Annulation par le client : barème de la politique figée dans la réservation.
 * - Après l'heure de départ : rien.
 */
export function calculerRemboursement(params: {
  politique: PolitiqueAnnulation;
  montantPaye: number;
  debut: Date;
  annuleLe: Date;
  par: "client" | "agence";
}): { pourcentage: number; montant: number } {
  if (params.par === "agence") return { pourcentage: 100, montant: params.montantPaye };
  const heures = (params.debut.getTime() - params.annuleLe.getTime()) / MS_HEURE;
  const palier =
    heures < 0
      ? undefined
      : BAREMES_ANNULATION[params.politique].find((p) => heures >= p.heuresAvantDepartMin);
  const pourcentage = palier?.pourcentage ?? 0;
  return { pourcentage, montant: Math.floor((params.montantPaye * pourcentage) / 100) };
}

/** Pénalité de score appliquée à une agence qui annule une réservation confirmée (6.3.5). */
export const PENALITE_ANNULATION_AGENCE = 5;

// ---------------------------------------------------------------------------
// 6.3.7 Conditions conducteur
// ---------------------------------------------------------------------------

export type ErreurConducteur =
  | "DATE_NAISSANCE_MANQUANTE"
  | "AGE_INSUFFISANT"
  | "PERMIS_MANQUANT"
  | "PERMIS_TROP_RECENT"
  | "PERMIS_EXPIRE";

/** Vérifie âge et ancienneté du permis à la date de départ. Renvoie la liste des problèmes. */
export function verifierConditionsConducteur(params: {
  dateNaissance: string | null | undefined;
  permis: { dateDelivrance: string | null; dateExpiration: string | null } | null | undefined;
  depart: Date;
  fin: Date;
  ageMinimum: number;
  ancienneteMinPermisAnnees: number;
}): ErreurConducteur[] {
  const erreurs: ErreurConducteur[] = [];
  if (!params.dateNaissance) erreurs.push("DATE_NAISSANCE_MANQUANTE");
  else if (ageEnAnnees(params.dateNaissance, params.depart) < params.ageMinimum)
    erreurs.push("AGE_INSUFFISANT");

  if (!params.permis?.dateDelivrance) erreurs.push("PERMIS_MANQUANT");
  else {
    if (
      anneesRevolues(params.permis.dateDelivrance, dateAlger(params.depart)) <
      params.ancienneteMinPermisAnnees
    )
      erreurs.push("PERMIS_TROP_RECENT");
    if (params.permis.dateExpiration && params.permis.dateExpiration < dateAlger(params.fin))
      erreurs.push("PERMIS_EXPIRE");
  }
  return erreurs;
}

// ---------------------------------------------------------------------------
// Commission (règle 6.3.8)
// ---------------------------------------------------------------------------

/** Commission due à la plateforme : uniquement pour les réservations venues de la plateforme. */
export function calculerCommission(params: {
  origine: "plateforme" | "comptoir" | "telephone" | "blocage";
  montant: number;
  tauxCommissionBp: number;
}): number {
  if (params.origine !== "plateforme") return 0;
  return Math.round((params.montant * params.tauxCommissionBp) / 10_000);
}
