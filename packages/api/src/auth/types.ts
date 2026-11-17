import type { Langue, PermissionEmploye, RoleMembre } from "@lvb/shared";
import type { Request } from "express";

export type UtilisateurConnecte = {
  id: string;
  telephone: string;
  langue: Langue;
  admin: boolean;
};

export type ContexteAgence = {
  agenceId: string;
  role: RoleMembre;
  permissions: PermissionEmploye[];
  statutAgence: "en_attente" | "validee" | "suspendue";
};

export type RequeteAuth = Request & {
  utilisateur?: UtilisateurConnecte;
  agence?: ContexteAgence;
};
