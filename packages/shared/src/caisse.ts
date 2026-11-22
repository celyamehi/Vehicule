/**
 * Caisse de l'agence et statistiques par véhicule : règles pures, testées sans base.
 *
 * Entrées : paiements réussis des locations (acompte, solde, frais).
 * Sorties : remboursements aux clients, dépenses saisies, coûts d'entretien.
 * Les cautions ne sont pas du chiffre d'affaires : elles sont suivies à part (« cautions détenues »).
 */
import type { TypePaiement } from "./constantes.js";
import { MS_JOUR } from "./dates.js";

export type SensMouvement = "entree" | "sortie" | "caution";

/** Sens d'un paiement dans la caisse. */
export function sensPaiement(type: TypePaiement): SensMouvement {
  switch (type) {
    case "acompte":
    case "solde":
    case "frais":
      return "entree";
    case "remboursement":
      return "sortie";
    case "caution":
    case "restitution_caution":
      return "caution";
  }
}

export type MouvementCaisse =
  | { origine: "paiement"; type: TypePaiement; montant: number }
  | { origine: "depense" | "entretien"; montant: number };

/** Totaux de la caisse sur une période. Montants entiers en DZD. */
export function bilanCaisse(mouvements: MouvementCaisse[]) {
  let entrees = 0;
  let sorties = 0;
  let cautionsDetenues = 0;
  for (const m of mouvements) {
    if (m.origine !== "paiement") {
      sorties += m.montant;
      continue;
    }
    const sens = sensPaiement(m.type);
    if (sens === "entree") entrees += m.montant;
    else if (sens === "sortie") sorties += m.montant;
    else cautionsDetenues += m.type === "caution" ? m.montant : -m.montant;
  }
  return { entrees, sorties, solde: entrees - sorties, cautionsDetenues };
}

/** Nombre de jours (décimal) pendant lesquels [debut, fin) chevauche [du, au). */
export function joursChevauchement(debut: Date, fin: Date, du: Date, au: Date): number {
  const d = Math.max(debut.getTime(), du.getTime());
  const f = Math.min(fin.getTime(), au.getTime());
  return f > d ? (f - d) / MS_JOUR : 0;
}

export type LigneStatVehicule = {
  vehiculeId: string;
  /** Nombre de locations commencées dans la période. */
  locations: number;
  /** Jours loués dans la période. */
  joursLoues: number;
  /** Chiffre d'affaires des locations (prix + frais de retour). */
  revenus: number;
  /** Dépenses + entretiens rattachés au véhicule. */
  couts: number;
};

/**
 * Statistiques d'une flotte : marge, taux d'occupation et classements
 * « les plus rentables » (marge) et « les plus loués » (locations puis jours).
 */
export function statistiquesFlotte(lignes: LigneStatVehicule[], joursPeriode: number) {
  const vehicules = lignes.map((l) => ({
    ...l,
    joursLoues: Math.round(l.joursLoues * 10) / 10,
    marge: l.revenus - l.couts,
    tauxOccupation:
      joursPeriode > 0 ? Math.min(100, Math.round((l.joursLoues / joursPeriode) * 100)) : 0,
  }));
  const plusRentables = [...vehicules].sort((a, b) => b.marge - a.marge || b.revenus - a.revenus);
  const plusLoues = [...vehicules].sort(
    (a, b) => b.locations - a.locations || b.joursLoues - a.joursLoues,
  );
  const totaux = vehicules.reduce(
    (t, v) => ({
      locations: t.locations + v.locations,
      revenus: t.revenus + v.revenus,
      couts: t.couts + v.couts,
      marge: t.marge + v.marge,
    }),
    { locations: 0, revenus: 0, couts: 0, marge: 0 },
  );
  return { vehicules, plusRentables, plusLoues, totaux };
}
