export type FicheVehicule = {
  id: string;
  marque: string;
  modele: string;
  annee: number;
  categorie: string;
  boite: string;
  carburant: string;
  places: number;
  options: Record<string, boolean>;
  kmInclusParJour: number | null;
  photos: string[];
  tarif: {
    prixJour: number;
    paliers: { aPartirDeJours: number; prixJour: number }[];
    supplements: Record<string, { parJour?: number; forfait?: number }>;
    caution: number;
  } | null;
  conditions: {
    ageMinimum: number;
    ancienneteMinPermisAnnees: number;
    politiqueAnnulation: "souple" | "moderee" | "stricte";
    confirmationInstantanee: boolean;
  };
  agence: {
    id: string;
    raisonSociale: string;
    adresse: string;
    wilaya: number;
    telephone: string;
    score: number;
  };
  pointRetrait: {
    id: string;
    nom: string;
    adresse: string;
    commune: string;
    horaires: Record<string, [string, string][]>;
    lat: number | null;
    lon: number | null;
  };
};

export type Prix = {
  jours: number;
  prixJourApplique: number;
  sousTotalLocation: number;
  options: { code: string; montant: number }[];
  fraisLivraison: number;
  remise: number;
  total: number;
  caution: number;
  disponible: boolean;
};
