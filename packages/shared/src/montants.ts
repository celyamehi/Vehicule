import type { Langue } from "./constantes.js";

const LOCALES: Record<Langue, string> = { fr: "fr-DZ", ar: "ar-DZ", kab: "fr-DZ" };

/** Formate un montant entier en dinars : « 12 500 DA » / « 12.500 د.ج ». */
export function formaterDZD(montant: number, langue: Langue = "fr"): string {
  if (!Number.isInteger(montant)) throw new RangeError("Les montants sont des entiers en DZD");
  const nombre = new Intl.NumberFormat(LOCALES[langue], {
    maximumFractionDigits: 0,
    numberingSystem: "latn",
  }).format(montant);
  return langue === "ar" ? `${nombre} د.ج` : `${nombre} DA`;
}

/** Locale Intl à utiliser pour les dates et nombres d'une langue de l'interface. */
export const localeIntl = (langue: Langue) => LOCALES[langue];
