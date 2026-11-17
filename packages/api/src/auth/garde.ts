import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { agences, membresAgence } from "@lvb/db";
import type { PermissionEmploye } from "@lvb/shared";
import { and, eq } from "drizzle-orm";
import { type Base, InjectBase } from "../base.js";
import { ErreurApi } from "../commun/erreur-api.js";
import { AuthService } from "./auth.service.js";
import { CLE_ADMIN, CLE_AGENCE, CLE_PERMISSION, CLE_PUBLIC } from "./decorateurs.js";
import type { RequeteAuth } from "./types.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Garde globale : authentification (Bearer JWT), rôle administrateur, et contexte agence.
 * Les droits sont toujours vérifiés côté serveur (section 9) : un membre n'accède qu'à son agence.
 */
@Injectable()
export class GardeAcces implements CanActivate {
  constructor(
    private readonly reflecteur: Reflector,
    private readonly auth: AuthService,
    @InjectBase() private readonly db: Base,
  ) {}

  private meta<T>(cle: string, ctx: ExecutionContext): T | undefined {
    return this.reflecteur.getAllAndOverride<T>(cle, [ctx.getHandler(), ctx.getClass()]);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== "http") return true;
    const req = ctx.switchToHttp().getRequest<RequeteAuth>();
    const entete = req.headers.authorization;
    const jeton = entete?.startsWith("Bearer ") ? entete.slice(7) : undefined;

    if (this.meta<boolean>(CLE_PUBLIC, ctx)) {
      // Route publique : on identifie l'utilisateur s'il est connecté, sans l'exiger.
      if (jeton)
        req.utilisateur = await this.auth.utilisateurDepuisJeton(jeton).catch(() => undefined);
      return true;
    }
    if (!jeton) throw new ErreurApi("NON_AUTHENTIFIE");
    req.utilisateur = await this.auth.utilisateurDepuisJeton(jeton);

    if (this.meta<boolean>(CLE_ADMIN, ctx) && !req.utilisateur.admin)
      throw new ErreurApi("ACCES_REFUSE");

    if (this.meta<boolean>(CLE_AGENCE, ctx)) {
      const demandee = req.headers["x-agence-id"];
      const agenceId = typeof demandee === "string" && UUID.test(demandee) ? demandee : undefined;
      const adhesions = await this.db
        .select({
          agenceId: membresAgence.agenceId,
          role: membresAgence.role,
          permissions: membresAgence.permissions,
          statutAgence: agences.statut,
        })
        .from(membresAgence)
        .innerJoin(agences, eq(agences.id, membresAgence.agenceId))
        .where(
          and(
            eq(membresAgence.utilisateurId, req.utilisateur.id),
            eq(membresAgence.actif, true),
            agenceId ? eq(membresAgence.agenceId, agenceId) : undefined,
          ),
        );
      // Sans en-tête, l'agence est déduite seulement si l'utilisateur n'en a qu'une.
      const adhesion = adhesions.length === 1 ? adhesions[0] : undefined;
      if (!adhesion) throw new ErreurApi("ACCES_REFUSE");
      if (adhesion.statutAgence === "suspendue") throw new ErreurApi("AGENCE_SUSPENDUE");
      req.agence = {
        agenceId: adhesion.agenceId,
        role: adhesion.role,
        permissions: adhesion.permissions as PermissionEmploye[],
        statutAgence: adhesion.statutAgence,
      };

      const permission = this.meta<PermissionEmploye | "gerant">(CLE_PERMISSION, ctx);
      if (permission && req.agence.role !== "gerant") {
        if (permission === "gerant" || !req.agence.permissions.includes(permission))
          throw new ErreurApi("ACCES_REFUSE");
      }
    }
    return true;
  }
}
