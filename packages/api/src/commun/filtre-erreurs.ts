import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { estViolationChevauchement, infosErreurPg, CODES_PG } from "@lvb/db";
import { type CodeErreur, type ReponseErreur, langueDepuis, traduire } from "@lvb/shared";
import type { Request, Response } from "express";
import { ZodError } from "zod";
import { ErreurApi } from "./erreur-api.js";

/** Contraintes d'unicité traduites en code métier. */
const UNICITES: Record<string, CodeErreur> = {
  vehicules_immatriculation_uq: "IMMATRICULATION_EXISTANTE",
  agences_nif_uq: "NIF_EXISTANT",
};

/** Convertit toute erreur au format unique `{ code, message, details }` (section 9). */
@Catch()
export class FiltreErreurs implements ExceptionFilter {
  private readonly log = new Logger("Erreurs");

  catch(erreur: unknown, hote: ArgumentsHost) {
    if (hote.getType() !== "http") return;
    const ctx = hote.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const langue = langueDepuis(req.headers["accept-language"]);
    const { statut, code, details } = this.analyser(erreur);
    if (statut >= 500) this.log.error(erreur instanceof Error ? erreur.stack : String(erreur));
    const corps: ReponseErreur = { code, message: traduire(langue, `erreurs.${code}`) };
    if (details !== undefined) corps.details = details;
    res.status(statut).json(corps);
  }

  private analyser(erreur: unknown): { statut: number; code: CodeErreur; details?: unknown } {
    if (erreur instanceof ErreurApi)
      return { statut: erreur.getStatus(), code: erreur.code, details: erreur.details };
    if (erreur instanceof ZodError)
      return {
        statut: HttpStatus.BAD_REQUEST,
        code: "REQUETE_INVALIDE",
        details: erreur.issues.map((i) => ({ champ: i.path.join("."), message: i.message })),
      };
    if (estViolationChevauchement(erreur))
      return { statut: HttpStatus.CONFLICT, code: "VEHICULE_INDISPONIBLE" };
    const pg = infosErreurPg(erreur);
    if (pg?.code === CODES_PG.violationUnicite)
      return {
        statut: HttpStatus.CONFLICT,
        code: (pg.contrainte && UNICITES[pg.contrainte]) || "CONFLIT",
      };
    if (pg?.code === CODES_PG.violationCleEtrangere || pg?.code === CODES_PG.violationCheck)
      return {
        statut: HttpStatus.BAD_REQUEST,
        code: "REQUETE_INVALIDE",
        details: { contrainte: pg.contrainte },
      };
    if (erreur instanceof HttpException) {
      const statut = erreur.getStatus();
      const code: CodeErreur =
        statut === 404
          ? "INTROUVABLE"
          : statut === 401
            ? "NON_AUTHENTIFIE"
            : statut === 403
              ? "ACCES_REFUSE"
              : statut === 429
                ? "TROP_DE_TENTATIVES"
                : statut < 500
                  ? "REQUETE_INVALIDE"
                  : "ERREUR_INTERNE";
      return { statut, code };
    }
    return { statut: HttpStatus.INTERNAL_SERVER_ERROR, code: "ERREUR_INTERNE" };
  }
}
