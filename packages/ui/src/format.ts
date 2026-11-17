import { FUSEAU_HORAIRE, type Langue, formaterDZD, localeIntl } from "@lvb/shared";

/** Dates affichées dans le fuseau Africa/Algiers. */
export function formaterDate(d: Date | string, langue: Langue, avecHeure = true) {
  return new Intl.DateTimeFormat(localeIntl(langue), {
    timeZone: FUSEAU_HORAIRE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(avecHeure ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
    numberingSystem: "latn",
  }).format(new Date(d));
}

export const formaterMontant = (n: number, langue: Langue) => formaterDZD(Math.round(n), langue);

/** Valeur d'un <input type="datetime-local"> (heure d'Alger) → ISO avec fuseau. */
export function depuisChampLocal(valeur: string): string {
  return `${valeur.length === 16 ? `${valeur}:00` : valeur}+01:00`;
}

/** Date → valeur de <input type="datetime-local"> en heure d'Alger. */
export function versChampLocal(d: Date | string): string {
  const parties = new Intl.DateTimeFormat("sv-SE", {
    timeZone: FUSEAU_HORAIRE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(d));
  return parties.replace(" ", "T");
}
