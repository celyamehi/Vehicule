import { HttpException, HttpStatus } from "@nestjs/common";
import type { CodeErreur } from "@lvb/shared";

const STATUTS: Partial<Record<CodeErreur, HttpStatus>> = {
  REQUETE_INVALIDE: HttpStatus.BAD_REQUEST,
  DATES_INVALIDES: HttpStatus.BAD_REQUEST,
  FICHIER_INVALIDE: HttpStatus.BAD_REQUEST,
  NON_AUTHENTIFIE: HttpStatus.UNAUTHORIZED,
  JETON_INVALIDE: HttpStatus.UNAUTHORIZED,
  OTP_INVALIDE: HttpStatus.UNAUTHORIZED,
  OTP_EXPIRE: HttpStatus.UNAUTHORIZED,
  ACCES_REFUSE: HttpStatus.FORBIDDEN,
  AGENCE_NON_VALIDEE: HttpStatus.FORBIDDEN,
  AGENCE_SUSPENDUE: HttpStatus.FORBIDDEN,
  CLIENT_LISTE_NOIRE: HttpStatus.FORBIDDEN,
  INTROUVABLE: HttpStatus.NOT_FOUND,
  TROP_DE_TENTATIVES: HttpStatus.TOO_MANY_REQUESTS,
  ERREUR_INTERNE: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** Erreur métier renvoyée au format `{ code, message, details }` (message traduit par le filtre). */
export class ErreurApi extends HttpException {
  constructor(
    public readonly code: CodeErreur,
    public readonly details?: unknown,
    statut?: HttpStatus,
  ) {
    super(code, statut ?? STATUTS[code] ?? HttpStatus.CONFLICT);
  }
}

export const introuvable = (details?: unknown) => new ErreurApi("INTROUVABLE", details);
export const accesRefuse = (details?: unknown) => new ErreurApi("ACCES_REFUSE", details);
