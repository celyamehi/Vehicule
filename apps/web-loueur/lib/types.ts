import type { StatutReservation } from "@lvb/shared";

export type DetailPrix = {
  jours: number;
  prixJourApplique: number;
  sousTotalLocation: number;
  options: { code: string; montant: number }[];
  fraisLivraison: number;
  remise: number;
  total: number;
  caution: number;
};

export type Reservation = {
  id: string;
  code: string;
  agenceId: string;
  vehiculeId: string;
  clientId: string | null;
  /** Entreprise facturée (client professionnel), sinon null. */
  entrepriseId?: string | null;
  debut: string;
  fin: string;
  origine: "plateforme" | "comptoir" | "telephone" | "blocage";
  statut: StatutReservation;
  prixTotal: number;
  caution: number;
  detailPrix: DetailPrix | null;
  politiqueAnnulation: "souple" | "moderee" | "stricte";
  expireLe: string | null;
  motifRefus: string | null;
  motifBlocage: string | null;
  noteInterne: string | null;
  optionsChoisies: string[];
  fraisRetour: null | {
    kmParcourus: number;
    kmSupplementaires: number;
    montantKm: number;
    huitiemesManquants: number;
    montantCarburant: number;
    joursRetard: number;
    montantRetard: number;
    montantDommages: number;
    total: number;
  };
  createdAt: string;
};

export type LigneReservation = Reservation & {
  client: string | null;
  telephone: string | null;
  vehicule: string;
  immatriculation: string;
};

export type Dommage = {
  id: string;
  zone: string;
  x: number;
  y: number;
  type: "rayure" | "bosse" | "casse" | "autre";
  description?: string;
};

export type EtatDesLieux = {
  id: string;
  moment: "depart" | "retour";
  kilometrage: number;
  carburant: number;
  dommages: Dommage[];
  observations: string | null;
  signeLe: string | null;
};

export type Vehicule = {
  id: string;
  marque: string;
  modele: string;
  annee: number;
  immatriculation: string;
  categorie: string;
  categorieId: string;
  boite: "manuelle" | "automatique";
  carburant: string;
  places: number;
  options: Record<string, boolean>;
  kilometrage: number;
  kmInclusParJour: number | null;
  statut: "disponible" | "loue" | "en_entretien" | "hors_service";
  visiblePlateforme: boolean;
  pointRetraitId: string;
  pointRetrait?: string;
  photo?: string | null;
  nbPhotos?: number;
};

export type PointRetrait = {
  id: string;
  nom: string;
  adresse: string;
  wilaya: number;
  commune: string;
  actif: boolean;
  lat: number | null;
  lon: number | null;
};
