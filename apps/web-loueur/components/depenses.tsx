"use client";

import type { CategorieDepense } from "@lvb/shared";
import type { Ton } from "@lvb/ui";
import {
  BadgePercent,
  CircleDashed,
  Disc3,
  Droplets,
  Fuel,
  Home,
  Megaphone,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export type LigneDepense = {
  id: string;
  origine: "depense" | "entretien";
  categorie: string;
  libelle: string;
  montant: number;
  date: string;
  vehiculeId: string | null;
  moyen: string | null;
  notes: string | null;
  vehicule: string | null;
  immatriculation: string | null;
};

/** Icône et couleur pastel de chaque catégorie (les types d'entretien tombent sur « entretien »). */
export const VISUEL_CATEGORIE: Record<CategorieDepense, [LucideIcon, Ton]> = {
  carburant: [Fuel, "peche"],
  pneus: [Disc3, "neutre"],
  reparation: [Wrench, "rose"],
  entretien: [Wrench, "lavande"],
  assurance: [ShieldCheck, "ciel"],
  lavage: [Droplets, "ciel"],
  loyer: [Home, "citron"],
  salaires: [Users, "menthe"],
  taxes: [BadgePercent, "citron"],
  publicite: [Megaphone, "marque"],
  autre: [CircleDashed, "neutre"],
};
export const visuelDepense = (d: Pick<LigneDepense, "origine" | "categorie">) =>
  d.origine === "entretien"
    ? VISUEL_CATEGORIE.entretien
    : (VISUEL_CATEGORIE[d.categorie as CategorieDepense] ?? VISUEL_CATEGORIE.autre);
