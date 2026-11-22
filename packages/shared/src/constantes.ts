/** Constantes et énumérations métier partagées (identiques aux enums PostgreSQL de @lvb/db). */

export const FUSEAU_HORAIRE = "Africa/Algiers";
export const DEVISE = "DZD";

export const LANGUES = ["fr", "ar", "kab"] as const;
export type Langue = (typeof LANGUES)[number];
export const LANGUE_PAR_DEFAUT: Langue = "fr";
/** Langues écrites de droite à gauche. */
export const LANGUES_RTL: readonly Langue[] = ["ar"];
export const estRtl = (langue: Langue) => LANGUES_RTL.includes(langue);

export const STATUTS_RESERVATION = [
  "en_attente_paiement",
  "en_attente_agence",
  "confirmee",
  "en_cours",
  "terminee",
  "refusee",
  "expiree",
  "annulee_client",
  "annulee_agence",
  "non_presentation",
  "litige",
] as const;
export type StatutReservation = (typeof STATUTS_RESERVATION)[number];

export const ORIGINES_RESERVATION = ["plateforme", "comptoir", "telephone", "blocage"] as const;
export type OrigineReservation = (typeof ORIGINES_RESERVATION)[number];

export const POLITIQUES_ANNULATION = ["souple", "moderee", "stricte"] as const;
export type PolitiqueAnnulation = (typeof POLITIQUES_ANNULATION)[number];

export const STATUTS_VEHICULE = ["disponible", "loue", "en_entretien", "hors_service"] as const;
export type StatutVehicule = (typeof STATUTS_VEHICULE)[number];

export const BOITES = ["manuelle", "automatique"] as const;
export type Boite = (typeof BOITES)[number];

export const CARBURANTS = ["essence", "diesel", "gpl", "hybride", "electrique"] as const;
export type Carburant = (typeof CARBURANTS)[number];

export const CATEGORIES_VEHICULE = ["citadine", "berline", "suv", "utilitaire", "minibus"] as const;
export type CodeCategorie = (typeof CATEGORIES_VEHICULE)[number];

/** Options qu'un véhicule peut proposer (clés de `vehicules.options` et `tarifs.supplements`). */
export const OPTIONS_VEHICULE = [
  "climatisation",
  "siegeBebe",
  "gps",
  "conducteurAdditionnel",
  "avecChauffeur",
] as const;
export type OptionVehicule = (typeof OPTIONS_VEHICULE)[number];
/** Options que le client peut ajouter (payantes) — la climatisation est une caractéristique. */
export const OPTIONS_RESERVABLES = [
  "siegeBebe",
  "gps",
  "conducteurAdditionnel",
  "avecChauffeur",
] as const;
export type OptionReservable = (typeof OPTIONS_RESERVABLES)[number];

export const STATUTS_AGENCE = ["en_attente", "validee", "suspendue"] as const;
export type StatutAgence = (typeof STATUTS_AGENCE)[number];

export const ROLES_MEMBRE = ["gerant", "employe"] as const;
export type RoleMembre = (typeof ROLES_MEMBRE)[number];

/** Permissions qu'un gérant peut accorder à un employé (section 4.11). */
export const PERMISSIONS_EMPLOYE = [
  "reservations.creer",
  "reservations.accepter",
  "reservations.depart_retour",
  "etats_des_lieux",
  "encaissements",
  "flotte.modifier",
  "tarifs.modifier",
] as const;
export type PermissionEmploye = (typeof PERMISSIONS_EMPLOYE)[number];

export const MOYENS_PAIEMENT = [
  "especes",
  "cib",
  "edahabia",
  "virement",
  "baridimob",
  "cheque",
] as const;
export type MoyenPaiement = (typeof MOYENS_PAIEMENT)[number];

export const TYPES_PAIEMENT = [
  "acompte",
  "solde",
  "caution",
  "restitution_caution",
  "remboursement",
  "frais",
] as const;
export type TypePaiement = (typeof TYPES_PAIEMENT)[number];

/** Catégories de dépenses de l'agence (page Dépenses). */
export const CATEGORIES_DEPENSE = [
  "carburant",
  "pneus",
  "reparation",
  "entretien",
  "assurance",
  "lavage",
  "loyer",
  "salaires",
  "taxes",
  "publicite",
  "autre",
] as const;
export type CategorieDepense = (typeof CATEGORIES_DEPENSE)[number];

/** Délais de la section 6.2, en minutes. */
export const DELAIS = {
  paiementMinutes: 15,
  confirmationAgenceMinutes: 120,
  battementParDefautMinutes: 120,
  litigeApresRetourHeures: 72,
  avisApresRetourJours: 14,
} as const;

/** Wilaya de lancement. */
export const WILAYA_BEJAIA = 6;
