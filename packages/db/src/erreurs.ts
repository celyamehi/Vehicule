/** Codes SQLSTATE PostgreSQL utiles à l'API. */
export const CODES_PG = {
  violationExclusion: "23P01",
  violationUnicite: "23505",
  violationCleEtrangere: "23503",
  violationCheck: "23514",
} as const;

type ErreurPg = { code?: string; constraint_name?: string; constraint?: string };

function versErreurPg(erreur: unknown): ErreurPg | undefined {
  if (typeof erreur !== "object" || erreur === null) return undefined;
  const e = erreur as ErreurPg & { cause?: unknown };
  if (typeof e.code === "string") return e;
  // Drizzle enveloppe parfois l'erreur du pilote dans `cause`.
  return e.cause ? versErreurPg(e.cause) : undefined;
}

/**
 * Vrai si l'erreur vient de la contrainte anti-double réservation `pas_de_chevauchement`.
 * L'API la traduit en `VEHICULE_INDISPONIBLE`.
 */
export function estViolationChevauchement(erreur: unknown): boolean {
  const e = versErreurPg(erreur);
  return (
    e?.code === CODES_PG.violationExclusion &&
    (e.constraint_name ?? e.constraint) === "pas_de_chevauchement"
  );
}

/** Renvoie le code SQLSTATE et le nom de contrainte d'une erreur PostgreSQL, s'il y en a. */
export function infosErreurPg(erreur: unknown): { code: string; contrainte?: string } | undefined {
  const e = versErreurPg(erreur);
  if (!e?.code) return undefined;
  const contrainte = e.constraint_name ?? e.constraint;
  return contrainte ? { code: e.code, contrainte } : { code: e.code };
}
