/**
 * Codes d'erreur de l'API (format `{ code, message, details }`, section 9).
 * Le message est traduit à partir de la clé `erreurs.<CODE>` des fichiers i18n.
 */
export const CODES_ERREUR = [
  "REQUETE_INVALIDE",
  "NON_AUTHENTIFIE",
  "ACCES_REFUSE",
  "INTROUVABLE",
  "CONFLIT",
  "ERREUR_INTERNE",
  "TROP_DE_TENTATIVES",
  "OTP_INVALIDE",
  "OTP_EXPIRE",
  "JETON_INVALIDE",
  "VEHICULE_INDISPONIBLE",
  "TRANSITION_INTERDITE",
  "TARIF_INTROUVABLE",
  "OPTION_INDISPONIBLE",
  "CONDITIONS_CONDUCTEUR",
  "AGENCE_NON_VALIDEE",
  "AGENCE_SUSPENDUE",
  "CLIENT_LISTE_NOIRE",
  "DATES_INVALIDES",
  "FICHIER_INVALIDE",
  "ETAT_DES_LIEUX_MANQUANT",
  "IMMATRICULATION_EXISTANTE",
  "NIF_EXISTANT",
  "CATEGORIE_DIFFERENTE",
] as const;
export type CodeErreur = (typeof CODES_ERREUR)[number];

export type ReponseErreur = {
  code: CodeErreur;
  message: string;
  details?: unknown;
};
