/** Règles pures des avis, amendes, factures et pages d'agence. */
import { DELAIS, type StatutReservation } from "./constantes.js";

const MS_JOUR = 86_400_000;

/** Règle 6.3.9 : un avis par réservation terminée, dans les 14 jours suivant le retour. */
export function avisPossible(p: {
  statut: StatutReservation;
  retourLe: Date | null;
  maintenant: Date;
}): boolean {
  if (p.statut !== "terminee" || !p.retourLe) return false;
  const ecoule = p.maintenant.getTime() - p.retourLe.getTime();
  return ecoule >= 0 && ecoule <= DELAIS.avisApresRetourJours * MS_JOUR;
}

/** Moyenne arrondie au dixième (null sans avis). */
export function noteMoyenne(notes: number[]): number | null {
  if (!notes.length) return null;
  return Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10;
}

export type ReservationPourAmende = {
  id: string;
  clientId: string | null;
  statut: StatutReservation;
  origine: string;
  debut: Date;
  fin: Date;
  departLe: Date | null;
  retourLe: Date | null;
};

/**
 * Retrouve la location en cours au moment d'une infraction : le véhicule était chez le client
 * entre la remise réelle (ou le début prévu) et le retour réel (ou la fin prévue).
 */
export function trouverLocationResponsable(
  date: Date,
  locations: ReservationPourAmende[],
): ReservationPourAmende | null {
  const candidates = locations.filter((r) => {
    if (r.origine === "blocage" || !r.clientId) return false;
    if (!["en_cours", "terminee", "litige"].includes(r.statut)) return false;
    const debut = (r.departLe ?? r.debut).getTime();
    const fin = (r.retourLe ?? (r.statut === "en_cours" ? new Date(8.64e15) : r.fin)).getTime();
    return date.getTime() >= debut && date.getTime() <= fin;
  });
  // En cas de chevauchement (impossible en principe), la plus récente au moment de l'infraction.
  return (
    candidates.sort(
      (a, b) => (b.departLe ?? b.debut).getTime() - (a.departLe ?? a.debut).getTime(),
    )[0] ?? null
  );
}

/** Numéro de facture « F-2026-00042 ». */
export const numeroFacture = (annee: string | number, rang: number) =>
  `F-${annee}-${String(rang).padStart(5, "0")}`;

/** Identifiant d'URL lisible à partir du nom de l'agence. */
export function creerSlug(nom: string, suffixe?: string): string {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return [base || "agence", suffixe].filter(Boolean).join("-");
}
