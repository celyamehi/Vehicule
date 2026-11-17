/**
 * Types, validation (Zod), règles métier pures et traductions partagés
 * entre l'API et les interfaces. Contenu ajouté à l'étape 2.
 */
export const FUSEAU_HORAIRE = "Africa/Algiers";
export const DEVISE = "DZD";
export const LANGUES = ["fr", "ar", "kab"] as const;
export type Langue = (typeof LANGUES)[number];
