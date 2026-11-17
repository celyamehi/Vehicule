/**
 * Dates dans le fuseau Africa/Algiers.
 * L'Algérie est en UTC+1 toute l'année (pas d'heure d'été depuis 1981), mais on passe par
 * Intl pour rester correct si cela changeait.
 */
import { FUSEAU_HORAIRE } from "./constantes.js";

const MS_MINUTE = 60_000;
export const MS_HEURE = 60 * MS_MINUTE;
export const MS_JOUR = 24 * MS_HEURE;

const formateurParties = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU_HORAIRE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parties(d: Date) {
  const p = Object.fromEntries(formateurParties.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    annee: Number(p.year),
    mois: Number(p.month),
    jour: Number(p.day),
    heure: Number(p.hour),
    minute: Number(p.minute),
    seconde: Number(p.second),
  };
}

/** Décalage d'Alger par rapport à UTC à l'instant `d`, en minutes (60 aujourd'hui). */
export function decalageAlgerMinutes(d: Date): number {
  const p = parties(d);
  const commeUtc = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde);
  return Math.round((commeUtc - Math.floor(d.getTime() / 1000) * 1000) / MS_MINUTE);
}

/** Date calendaire à Alger au format AAAA-MM-JJ. */
export function dateAlger(d: Date): string {
  const p = parties(d);
  return `${p.annee}-${String(p.mois).padStart(2, "0")}-${String(p.jour).padStart(2, "0")}`;
}

/** Heure locale d'Alger au format HH:MM. */
export function heureAlger(d: Date): string {
  const p = parties(d);
  return `${String(p.heure).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * Convertit une date/heure locale d'Alger (`2026-07-01T10:00` ou `2026-07-01`) en instant.
 */
export function depuisHeureAlger(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(local);
  if (!m) throw new RangeError(`Date locale invalide : ${local}`);
  const [, a, mo, j, h = "0", mi = "0", s = "0"] = m;
  const commeUtc = Date.UTC(+a!, +mo! - 1, +j!, +h, +mi, +s);
  // Premier essai avec le décalage courant, puis correction si l'instant tombe sur un autre décalage.
  let instant = new Date(commeUtc - decalageAlgerMinutes(new Date(commeUtc)) * MS_MINUTE);
  instant = new Date(commeUtc - decalageAlgerMinutes(instant) * MS_MINUTE);
  return instant;
}

/** Âge révolu en années à la date `a` (à Alger), pour une date de naissance AAAA-MM-JJ. */
export function ageEnAnnees(dateNaissance: string, a: Date): number {
  return anneesRevolues(dateNaissance, dateAlger(a));
}

/** Nombre d'années révolues entre deux dates calendaires AAAA-MM-JJ. */
export function anneesRevolues(depuis: string, jusqua: string): number {
  const [a1, m1, j1] = depuis.split("-").map(Number) as [number, number, number];
  const [a2, m2, j2] = jusqua.split("-").map(Number) as [number, number, number];
  let n = a2 - a1;
  if (m2 < m1 || (m2 === m1 && j2 < j1)) n -= 1;
  return n;
}

/** Ajoute des minutes à une date. */
export const ajouterMinutes = (d: Date, minutes: number) =>
  new Date(d.getTime() + minutes * MS_MINUTE);
