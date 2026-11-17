import { type ExecutionContext, SetMetadata, createParamDecorator } from "@nestjs/common";
import type { PermissionEmploye } from "@lvb/shared";
import type { ContexteAgence, RequeteAuth, UtilisateurConnecte } from "./types.js";

export const CLE_PUBLIC = "route_publique";
export const CLE_ADMIN = "route_admin";
export const CLE_AGENCE = "route_agence";
export const CLE_PERMISSION = "permission_agence";

/** Route accessible sans connexion (visiteur). */
export const Public = () => SetMetadata(CLE_PUBLIC, true);
/** Route réservée aux administrateurs de la plateforme. */
export const Admin = () => SetMetadata(CLE_ADMIN, true);
/** Route du logiciel loueur : exige d'être membre de l'agence (en-tête X-Agence-Id). */
export const RouteAgence = () => SetMetadata(CLE_AGENCE, true);
/** Permission requise pour un employé (le gérant a tous les droits). */
export const Permission = (p: PermissionEmploye | "gerant") => SetMetadata(CLE_PERMISSION, p);

export const Moi = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): UtilisateurConnecte =>
    ctx.switchToHttp().getRequest<RequeteAuth>().utilisateur!,
);

export const MonAgence = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): ContexteAgence =>
    ctx.switchToHttp().getRequest<RequeteAuth>().agence!,
);

export const AdresseIp = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): string | null =>
    ctx.switchToHttp().getRequest<RequeteAuth>().ip ?? null,
);
