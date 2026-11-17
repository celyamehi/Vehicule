/**
 * Schéma de la base (section 8 du cahier des charges), tables de la Phase 1.
 *
 * Conventions :
 * - clés TypeScript en camelCase, colonnes SQL en snake_case (option `casing: "snake_case"`) ;
 * - chaque table : `id` UUID, `created_at`, `updated_at` (mis à jour par trigger SQL) ;
 * - montants en DZD, entiers (`integer`), jamais de décimales ;
 * - dates en `timestamptz`.
 *
 * Ce qui ne s'exprime pas en Drizzle (extensions, contrainte d'exclusion, triggers) est écrit
 * en SQL dans les migrations manuelles de `drizzle/`.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Types personnalisés
// ---------------------------------------------------------------------------

/** Plage temporelle PostgreSQL `tstzrange`, lue sous forme de texte brut (ex. `["2026-…","2026-…")`). */
export const tstzrange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tstzrange";
  },
});

/** Point géographique PostGIS (WGS 84). Écrit/lu au format EWKT/hex ; l'API passe par ST_* en SQL. */
export const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  },
});

// ---------------------------------------------------------------------------
// Énumérations
// ---------------------------------------------------------------------------

export const langueEnum = pgEnum("langue", ["fr", "ar", "kab", "en"]);
export const statutUtilisateurEnum = pgEnum("statut_utilisateur", ["actif", "bloque", "supprime"]);
export const rolePlateformeEnum = pgEnum("role_plateforme", ["utilisateur", "admin"]);
export const typeDocumentEnum = pgEnum("type_document", ["permis", "cni", "passeport"]);
export const statutVerificationEnum = pgEnum("statut_verification", [
  "en_attente",
  "verifie",
  "refuse",
]);
export const statutAgenceEnum = pgEnum("statut_agence", ["en_attente", "validee", "suspendue"]);
export const roleMembreEnum = pgEnum("role_membre", ["gerant", "employe"]);
export const statutVehiculeEnum = pgEnum("statut_vehicule", [
  "disponible",
  "loue",
  "en_entretien",
  "hors_service",
]);
export const boiteEnum = pgEnum("boite", ["manuelle", "automatique"]);
export const carburantEnum = pgEnum("carburant", [
  "essence",
  "diesel",
  "gpl",
  "hybride",
  "electrique",
]);
export const politiqueAnnulationEnum = pgEnum("politique_annulation", [
  "souple",
  "moderee",
  "stricte",
]);
export const origineReservationEnum = pgEnum("origine_reservation", [
  "plateforme",
  "comptoir",
  "telephone",
  "blocage",
]);
export const statutReservationEnum = pgEnum("statut_reservation", [
  "en_attente_paiement",
  "en_attente_agence",
  "confirmee",
  "en_cours",
  "terminee",
  "refusee",
  "expiree",
  "annulee_client",
  "annulee_agence",
  "non_presentation",
  "litige",
]);
export const momentEtatDesLieuxEnum = pgEnum("moment_etat_des_lieux", ["depart", "retour"]);
export const typePaiementEnum = pgEnum("type_paiement", [
  "acompte",
  "solde",
  "caution",
  "restitution_caution",
  "remboursement",
  "frais",
]);
export const moyenPaiementEnum = pgEnum("moyen_paiement", [
  "especes",
  "cib",
  "edahabia",
  "virement",
  "baridimob",
  "cheque",
]);
export const statutPaiementEnum = pgEnum("statut_paiement", [
  "en_attente",
  "reussi",
  "echoue",
  "annule",
]);

/** Statuts qui bloquent le véhicule (section 6.2) — identiques au WHERE de la contrainte d'exclusion. */
export const STATUTS_BLOQUANTS = [
  "en_attente_paiement",
  "en_attente_agence",
  "confirmee",
  "en_cours",
] as const;

// ---------------------------------------------------------------------------
// Colonnes communes
// ---------------------------------------------------------------------------

const horodatage = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};
const cleId = { id: uuid().primaryKey().defaultRandom() };

// ---------------------------------------------------------------------------
// Utilisateurs et identité
// ---------------------------------------------------------------------------

export const utilisateurs = pgTable(
  "utilisateurs",
  {
    ...cleId,
    telephone: text().notNull(),
    email: text(),
    nom: text(),
    prenom: text(),
    dateNaissance: date(),
    langue: langueEnum().notNull().default("fr"),
    statut: statutUtilisateurEnum().notNull().default("actif"),
    rolePlateforme: rolePlateformeEnum().notNull().default("utilisateur"),
    consentementLe: timestamp({ withTimezone: true }),
    ...horodatage,
  },
  (t) => [
    uniqueIndex("utilisateurs_telephone_uq").on(t.telephone),
    uniqueIndex("utilisateurs_email_uq").on(sql`lower(${t.email})`),
    check("utilisateurs_telephone_format", sql`${t.telephone} ~ '^\\+[0-9]{8,15}$'`),
  ],
);

export const documentsIdentite = pgTable(
  "documents_identite",
  {
    ...cleId,
    utilisateurId: uuid()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    type: typeDocumentEnum().notNull(),
    numero: text(),
    dateDelivrance: date(),
    dateExpiration: date(),
    /** Clés des fichiers dans le stockage S3 (recto, verso…), jamais le contenu. */
    fichiers: jsonb().$type<{ recto?: string; verso?: string }>().notNull().default({}),
    statutVerification: statutVerificationEnum().notNull().default("en_attente"),
    verifiePar: uuid().references(() => utilisateurs.id),
    verifieLe: timestamp({ withTimezone: true }),
    ...horodatage,
  },
  (t) => [index("documents_identite_utilisateur_idx").on(t.utilisateurId)],
);

/** Codes OTP envoyés par SMS (hachés). */
export const codesOtp = pgTable(
  "codes_otp",
  {
    ...cleId,
    telephone: text().notNull(),
    codeHash: text().notNull(),
    expireLe: timestamp({ withTimezone: true }).notNull(),
    essais: smallint().notNull().default(0),
    utiliseLe: timestamp({ withTimezone: true }),
    ...horodatage,
  },
  (t) => [index("codes_otp_telephone_idx").on(t.telephone, t.createdAt)],
);

/** Jetons de rafraîchissement (hachés), révocables. */
export const sessions = pgTable(
  "sessions",
  {
    ...cleId,
    utilisateurId: uuid()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    jetonHash: text().notNull(),
    expireLe: timestamp({ withTimezone: true }).notNull(),
    revoqueLe: timestamp({ withTimezone: true }),
    appareil: text(),
    ...horodatage,
  },
  (t) => [uniqueIndex("sessions_jeton_uq").on(t.jetonHash)],
);

// ---------------------------------------------------------------------------
// Agences
// ---------------------------------------------------------------------------

export const agences = pgTable(
  "agences",
  {
    ...cleId,
    raisonSociale: text().notNull(),
    nif: text().notNull(),
    registreCommerce: text().notNull(),
    agrement: text(),
    /** Code de wilaya (1 à 58). */
    wilaya: smallint().notNull(),
    adresse: text().notNull(),
    telephone: text().notNull(),
    email: text(),
    logoUrl: text(),
    photos: jsonb().$type<string[]>().notNull().default([]),
    justificatifs: jsonb().$type<string[]>().notNull().default([]),
    statut: statutAgenceEnum().notNull().default("en_attente"),
    motifStatut: text(),
    valideeLe: timestamp({ withTimezone: true }),
    /** Taux de commission en points de base (1000 = 10 %), entier. */
    tauxCommissionBp: integer().notNull().default(1000),
    /** Score de fiabilité de l'agence, sur 100. */
    score: integer().notNull().default(100),
    // Paramètres
    battementMinutes: integer().notNull().default(120),
    confirmationInstantanee: boolean().notNull().default(false),
    politiqueAnnulation: politiqueAnnulationEnum().notNull().default("moderee"),
    ageMinimum: smallint().notNull().default(21),
    ancienneteMinPermisAnnees: smallint().notNull().default(2),
    /** Frais au retour (4.6) : prix d'un kilomètre au-delà du forfait, d'un huitième de réservoir. */
    prixKmSupplementaire: integer().notNull().default(20),
    prixHuitiemeCarburant: integer().notNull().default(1000),
    ...horodatage,
  },
  (t) => [
    uniqueIndex("agences_nif_uq").on(t.nif),
    index("agences_statut_wilaya_idx").on(t.statut, t.wilaya),
    check("agences_wilaya_valide", sql`${t.wilaya} BETWEEN 1 AND 58`),
    check("agences_battement_positif", sql`${t.battementMinutes} BETWEEN 0 AND 1440`),
    check("agences_commission_valide", sql`${t.tauxCommissionBp} BETWEEN 0 AND 10000`),
    check("agences_age_minimum", sql`${t.ageMinimum} BETWEEN 18 AND 99`),
    check(
      "agences_frais_positifs",
      sql`${t.prixKmSupplementaire} >= 0 AND ${t.prixHuitiemeCarburant} >= 0`,
    ),
  ],
);

export const membresAgence = pgTable(
  "membres_agence",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id, { onDelete: "cascade" }),
    utilisateurId: uuid()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    role: roleMembreEnum().notNull(),
    /** Droits fins des employés, fixés par le gérant (ex. ["reservations.creer", "encaissements"]). */
    permissions: jsonb().$type<string[]>().notNull().default([]),
    actif: boolean().notNull().default(true),
    ...horodatage,
  },
  (t) => [uniqueIndex("membres_agence_uq").on(t.agenceId, t.utilisateurId)],
);

export const pointsRetrait = pgTable(
  "points_retrait",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id, { onDelete: "cascade" }),
    nom: text().notNull(),
    adresse: text().notNull(),
    wilaya: smallint().notNull(),
    commune: text().notNull(),
    position: geographyPoint(),
    /** Horaires d'ouverture par jour : { "lun": [["08:00","18:00"]], … }. */
    horaires: jsonb().$type<Record<string, [string, string][]>>().notNull().default({}),
    actif: boolean().notNull().default(true),
    ...horodatage,
  },
  (t) => [
    unique("points_retrait_id_agence_uq").on(t.id, t.agenceId),
    index("points_retrait_agence_idx").on(t.agenceId),
    index("points_retrait_wilaya_commune_idx").on(t.wilaya, t.commune),
    index("points_retrait_position_gix").using("gist", t.position),
    check("points_retrait_wilaya_valide", sql`${t.wilaya} BETWEEN 1 AND 58`),
  ],
);

/** Clients connus d'une agence : notes internes, liste noire (section 4.7), non partagés. */
export const clientsAgence = pgTable(
  "clients_agence",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id, { onDelete: "cascade" }),
    utilisateurId: uuid()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    notesInternes: text(),
    listeNoire: boolean().notNull().default(false),
    motifListeNoire: text(),
    ...horodatage,
  },
  (t) => [uniqueIndex("clients_agence_uq").on(t.agenceId, t.utilisateurId)],
);

// ---------------------------------------------------------------------------
// Flotte et tarifs
// ---------------------------------------------------------------------------

export const categoriesVehicule = pgTable("categories_vehicule", {
  ...cleId,
  code: text().notNull().unique(),
  libelles: jsonb().$type<{ fr: string; ar: string; kab: string; en?: string }>().notNull(),
  ordre: smallint().notNull().default(0),
  ...horodatage,
});

/** Options proposées par véhicule (siège bébé, GPS…). */
export type OptionsVehicule = {
  climatisation?: boolean;
  siegeBebe?: boolean;
  gps?: boolean;
  conducteurAdditionnel?: boolean;
  avecChauffeur?: boolean;
  [cle: string]: boolean | undefined;
};

export const vehicules = pgTable(
  "vehicules",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id, { onDelete: "cascade" }),
    pointRetraitId: uuid().notNull(),
    categorieId: uuid()
      .notNull()
      .references(() => categoriesVehicule.id),
    marque: text().notNull(),
    modele: text().notNull(),
    annee: smallint().notNull(),
    immatriculation: text().notNull(),
    boite: boiteEnum().notNull(),
    carburant: carburantEnum().notNull(),
    places: smallint().notNull(),
    options: jsonb().$type<OptionsVehicule>().notNull().default({}),
    kilometrage: integer().notNull().default(0),
    /** Kilomètres inclus par jour (null = illimité). */
    kmInclusParJour: integer(),
    statut: statutVehiculeEnum().notNull().default("disponible"),
    visiblePlateforme: boolean().notNull().default(true),
    ...horodatage,
  },
  (t) => [
    unique("vehicules_id_agence_uq").on(t.id, t.agenceId),
    uniqueIndex("vehicules_immatriculation_uq").on(t.agenceId, t.immatriculation),
    index("vehicules_recherche_idx").on(t.categorieId, t.statut, t.visiblePlateforme),
    foreignKey({
      name: "vehicules_point_retrait_meme_agence_fk",
      columns: [t.pointRetraitId, t.agenceId],
      foreignColumns: [pointsRetrait.id, pointsRetrait.agenceId],
    }),
    check("vehicules_annee_valide", sql`${t.annee} BETWEEN 1990 AND 2100`),
    check("vehicules_places_valide", sql`${t.places} BETWEEN 1 AND 60`),
    check("vehicules_kilometrage_positif", sql`${t.kilometrage} >= 0`),
  ],
);

export const photosVehicule = pgTable(
  "photos_vehicule",
  {
    ...cleId,
    vehiculeId: uuid()
      .notNull()
      .references(() => vehicules.id, { onDelete: "cascade" }),
    /** Clé de l'objet dans le stockage S3. */
    url: text().notNull(),
    ordre: smallint().notNull().default(0),
    ...horodatage,
  },
  (t) => [index("photos_vehicule_vehicule_idx").on(t.vehiculeId, t.ordre)],
);

/** Palier dégressif : à partir de `aPartirDeJours` jours, prix par jour réduit à `prixJour`. */
export type PalierTarif = { aPartirDeJours: number; prixJour: number };
/** Suppléments en DZD : par jour (`parJour`) ou forfaitaires (`forfait`). */
export type SupplementsTarif = Record<string, { parJour?: number; forfait?: number }>;

export const tarifs = pgTable(
  "tarifs",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id, { onDelete: "cascade" }),
    vehiculeId: uuid().references(() => vehicules.id, { onDelete: "cascade" }),
    categorieId: uuid().references(() => categoriesVehicule.id),
    libelle: text(),
    prixJour: integer().notNull(),
    paliers: jsonb().$type<PalierTarif[]>().notNull().default([]),
    supplements: jsonb().$type<SupplementsTarif>().notNull().default({}),
    /** Saison (bornes incluses) ; null = tarif de base. */
    saisonDebut: date(),
    saisonFin: date(),
    caution: integer().notNull().default(0),
    actif: boolean().notNull().default(true),
    ...horodatage,
  },
  (t) => [
    index("tarifs_agence_idx").on(t.agenceId),
    index("tarifs_vehicule_idx").on(t.vehiculeId),
    check("tarifs_cible_unique", sql`(${t.vehiculeId} IS NULL) <> (${t.categorieId} IS NULL)`),
    check("tarifs_prix_positif", sql`${t.prixJour} > 0 AND ${t.caution} >= 0`),
    check(
      "tarifs_saison_coherente",
      sql`(${t.saisonDebut} IS NULL AND ${t.saisonFin} IS NULL) OR (${t.saisonDebut} IS NOT NULL AND ${t.saisonFin} IS NOT NULL AND ${t.saisonFin} >= ${t.saisonDebut})`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

/** Détail du prix figé au moment de la confirmation (règle 6.3.6). Montants en DZD. */
export type DetailPrix = {
  jours: number;
  prixJourApplique: number;
  sousTotalLocation: number;
  options: { code: string; montant: number }[];
  fraisLivraison: number;
  remise: number;
  total: number;
  caution: number;
  tarifId?: string;
};

/** Frais au retour, en DZD. */
export type FraisRetour = {
  kmParcourus: number;
  kmInclus: number | null;
  kmSupplementaires: number;
  montantKm: number;
  huitiemesManquants: number;
  montantCarburant: number;
  joursRetard: number;
  montantRetard: number;
  montantDommages: number;
  total: number;
};

/** Conditions copiées dans la réservation (âge, permis, km, carburant, annulation). */
export type ConditionsFigees = {
  ageMinimum: number;
  ancienneteMinPermisAnnees: number;
  kmInclusParJour: number | null;
  politiqueAnnulation: "souple" | "moderee" | "stricte";
};

export const reservations = pgTable(
  "reservations",
  {
    ...cleId,
    /** Code lisible communiqué au client (ex. BJA-7K3QX9). */
    code: text().notNull(),
    agenceId: uuid()
      .notNull()
      .references(() => agences.id),
    vehiculeId: uuid().notNull(),
    /** Null uniquement pour un blocage manuel (origine = blocage). */
    clientId: uuid().references(() => utilisateurs.id),
    pointRetraitDepartId: uuid(),
    pointRetraitRetourId: uuid(),
    debut: timestamp({ withTimezone: true }).notNull(),
    fin: timestamp({ withTimezone: true }).notNull(),
    /** Battement copié depuis l'agence à la création. */
    battementMinutes: integer().notNull().default(120),
    /** [debut, fin + battement) — calculé par trigger SQL, utilisé par la contrainte d'exclusion. */
    periode: tstzrange()
      .notNull()
      .default(sql`'empty'::tstzrange`),
    origine: origineReservationEnum().notNull(),
    statut: statutReservationEnum().notNull(),
    prixTotal: integer().notNull().default(0),
    detailPrix: jsonb().$type<DetailPrix>(),
    politiqueAnnulation: politiqueAnnulationEnum().notNull(),
    caution: integer().notNull().default(0),
    conditions: jsonb().$type<ConditionsFigees>(),
    optionsChoisies: jsonb().$type<string[]>().notNull().default([]),
    /** Échéance d'expiration pour les statuts en attente (job planifié, règle 6.3.3). */
    expireLe: timestamp({ withTimezone: true }),
    motifRefus: text(),
    motifBlocage: text(),
    noteInterne: text(),
    creePar: uuid().references(() => utilisateurs.id),
    confirmeeLe: timestamp({ withTimezone: true }),
    departLe: timestamp({ withTimezone: true }),
    retourLe: timestamp({ withTimezone: true }),
    annuleeLe: timestamp({ withTimezone: true }),
    /** Frais calculés au retour (comparaison des états des lieux, section 4.6). */
    fraisRetour: jsonb().$type<FraisRetour>(),
    ...horodatage,
  },
  (t) => [
    uniqueIndex("reservations_code_uq").on(t.code),
    index("reservations_agence_debut_idx").on(t.agenceId, t.debut),
    index("reservations_client_idx").on(t.clientId, t.debut),
    index("reservations_expiration_idx")
      .on(t.expireLe)
      .where(sql`${t.statut} IN ('en_attente_paiement', 'en_attente_agence')`),
    foreignKey({
      name: "reservations_vehicule_meme_agence_fk",
      columns: [t.vehiculeId, t.agenceId],
      foreignColumns: [vehicules.id, vehicules.agenceId],
    }),
    foreignKey({
      name: "reservations_point_depart_meme_agence_fk",
      columns: [t.pointRetraitDepartId, t.agenceId],
      foreignColumns: [pointsRetrait.id, pointsRetrait.agenceId],
    }),
    foreignKey({
      name: "reservations_point_retour_meme_agence_fk",
      columns: [t.pointRetraitRetourId, t.agenceId],
      foreignColumns: [pointsRetrait.id, pointsRetrait.agenceId],
    }),
    check("reservations_dates_coherentes", sql`${t.fin} > ${t.debut}`),
    check("reservations_battement_valide", sql`${t.battementMinutes} BETWEEN 0 AND 1440`),
    check("reservations_montants_positifs", sql`${t.prixTotal} >= 0 AND ${t.caution} >= 0`),
    check(
      "reservations_client_obligatoire",
      sql`(${t.origine} = 'blocage') OR (${t.clientId} IS NOT NULL)`,
    ),
  ],
);

export const contrats = pgTable(
  "contrats",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id),
    reservationId: uuid()
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    numero: text().notNull(),
    pdfUrl: text(),
    /** Empreinte SHA-256 du PDF signé. */
    empreintePdf: text(),
    signeLe: timestamp({ withTimezone: true }),
    /** Clé S3 de l'image de signature du client + métadonnées (IP, appareil). */
    signatureClient: jsonb().$type<{ image: string; ip?: string; appareil?: string }>(),
    signatureAgence: jsonb().$type<{ image: string; parUtilisateurId: string }>(),
    ...horodatage,
  },
  (t) => [
    uniqueIndex("contrats_reservation_uq").on(t.reservationId),
    uniqueIndex("contrats_numero_uq").on(t.agenceId, t.numero),
  ],
);

/** Dommage pointé sur le schéma du véhicule (coordonnées relatives 0-1). */
export type Dommage = {
  id: string;
  zone: string;
  x: number;
  y: number;
  type: "rayure" | "bosse" | "casse" | "autre";
  description?: string;
  photo?: string;
};

export const etatsDesLieux = pgTable(
  "etats_des_lieux",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id),
    reservationId: uuid()
      .notNull()
      .references(() => reservations.id, { onDelete: "cascade" }),
    moment: momentEtatDesLieuxEnum().notNull(),
    kilometrage: integer().notNull(),
    /** Niveau de carburant en huitièmes (0 à 8). */
    carburant: smallint().notNull(),
    dommages: jsonb().$type<Dommage[]>().notNull().default([]),
    photos: jsonb().$type<{ cle: string; prisLe: string }[]>().notNull().default([]),
    observations: text(),
    signePar: uuid().references(() => utilisateurs.id),
    signatureClient: jsonb().$type<{ image: string; ip?: string }>(),
    signeLe: timestamp({ withTimezone: true }),
    ...horodatage,
  },
  (t) => [
    uniqueIndex("etats_des_lieux_uq").on(t.reservationId, t.moment),
    check("etats_des_lieux_carburant", sql`${t.carburant} BETWEEN 0 AND 8`),
    check("etats_des_lieux_km", sql`${t.kilometrage} >= 0`),
  ],
);

export const paiements = pgTable(
  "paiements",
  {
    ...cleId,
    agenceId: uuid()
      .notNull()
      .references(() => agences.id),
    reservationId: uuid()
      .notNull()
      .references(() => reservations.id),
    type: typePaiementEnum().notNull(),
    moyen: moyenPaiementEnum().notNull(),
    montant: integer().notNull(),
    statut: statutPaiementEnum().notNull().default("en_attente"),
    /** Identifiant chez la passerelle ; unique pour rendre le webhook idempotent. */
    referenceExterne: text(),
    enregistrePar: uuid().references(() => utilisateurs.id),
    ...horodatage,
  },
  (t) => [
    index("paiements_reservation_idx").on(t.reservationId),
    uniqueIndex("paiements_reference_externe_uq").on(t.referenceExterne),
    check("paiements_montant_positif", sql`${t.montant} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Tables techniques
// ---------------------------------------------------------------------------

export const journalActions = pgTable(
  "journal_actions",
  {
    ...cleId,
    agenceId: uuid().references(() => agences.id),
    utilisateurId: uuid().references(() => utilisateurs.id),
    /** Ex. "reservation.annuler", "tarif.modifier", "document.consulter". */
    action: text().notNull(),
    entite: text().notNull(),
    entiteId: uuid(),
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ip: text(),
    ...horodatage,
  },
  (t) => [
    index("journal_actions_agence_idx").on(t.agenceId, t.createdAt),
    index("journal_actions_entite_idx").on(t.entite, t.entiteId),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    ...cleId,
    utilisateurId: uuid()
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** Clé de traduction du message (ex. "notif.reservation_confirmee"). */
    type: text().notNull(),
    donnees: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    canal: text().notNull().default("app"),
    lueLe: timestamp({ withTimezone: true }),
    envoyeeLe: timestamp({ withTimezone: true }),
    ...horodatage,
  },
  (t) => [index("notifications_utilisateur_idx").on(t.utilisateurId, t.createdAt)],
);
