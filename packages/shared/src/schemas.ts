/**
 * Schémas Zod des entrées de l'API (section 9). Utilisés côté serveur pour valider et côté
 * interfaces pour valider les formulaires avant envoi. Les messages d'erreur sont des clés
 * de traduction (`validation.*`).
 */
import { z } from "zod";
import {
  BOITES,
  CARBURANTS,
  CATEGORIES_VEHICULE,
  LANGUES,
  MOYENS_PAIEMENT,
  OPTIONS_RESERVABLES,
  PERMISSIONS_EMPLOYE,
  POLITIQUES_ANNULATION,
  STATUTS_RESERVATION,
  STATUTS_VEHICULE,
  TYPES_PAIEMENT,
} from "./constantes.js";

// ---------------------------------------------------------------------------
// Briques
// ---------------------------------------------------------------------------

/**
 * Numéro de téléphone normalisé au format E.164.
 * Accepte « 0550 12 34 56 », « 00213550123456 », « +213 550 123 456 » ou un numéro étranger.
 */
export const telephone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.\-()]/g, ""))
  .transform((v) => {
    if (/^0[5-7]\d{8}$/.test(v) || /^0[1-4,9]\d{7}$/.test(v)) return `+213${v.slice(1)}`;
    if (v.startsWith("00")) return `+${v.slice(2)}`;
    return v;
  })
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "validation.telephone"));

/** Montant en dinars : entier positif ou nul. */
export const montant = z.number().int("validation.entier").min(0, "validation.positif");
export const montantStrict = z.number().int("validation.entier").positive("validation.positif");

/** Instant ISO 8601 avec fuseau (ex. 2026-07-01T10:00:00+01:00), converti en Date. */
export const instant = z.iso
  .datetime({ offset: true, message: "validation.date" })
  .transform((v) => new Date(v));

/** Date calendaire AAAA-MM-JJ. */
export const dateCalendaire = z.iso.date("validation.date");

export const uuid = z.uuid("validation.identifiant");

const periodeBase = z.object({ debut: instant, fin: instant });
const finApresDebut = <T extends { debut: Date; fin: Date }>(p: T) => p.fin > p.debut;
export const periode = periodeBase.refine(finApresDebut, {
  message: "validation.fin_avant_debut",
  path: ["fin"],
});

/** Pagination standard. */
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  parPage: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

export const otpEnvoyer = z.object({ telephone });
export const otpVerifier = z.object({
  telephone,
  code: z.string().regex(/^\d{6}$/, "validation.code_otp"),
  appareil: z.string().max(200).optional(),
});
export const rafraichir = z.object({ jetonRafraichissement: z.string().min(20) });

export const profilModifier = z.object({
  nom: z.string().trim().min(1).max(100).optional(),
  prenom: z.string().trim().min(1).max(100).optional(),
  email: z.email("validation.email").optional().nullable(),
  dateNaissance: dateCalendaire.optional(),
  langue: z.enum(LANGUES).optional(),
  consentement: z.literal(true).optional(),
});

export const documentIdentite = z.object({
  type: z.enum(["permis", "cni", "passeport"]),
  numero: z.string().trim().min(3).max(50),
  dateDelivrance: dateCalendaire,
  dateExpiration: dateCalendaire.optional().nullable(),
  fichiers: z.object({ recto: z.string().min(1).optional(), verso: z.string().min(1).optional() }),
});

// ---------------------------------------------------------------------------
// Recherche (client)
// ---------------------------------------------------------------------------

const booleenRequete = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

export const rechercheParams = z
  .object({
    wilaya: z.coerce.number().int().min(1).max(58).optional(),
    commune: z.string().trim().max(100).optional(),
    pointRetraitId: uuid.optional(),
    debut: instant,
    fin: instant,
    categorie: z.enum(CATEGORIES_VEHICULE).optional(),
    boite: z.enum(BOITES).optional(),
    carburant: z.enum(CARBURANTS).optional(),
    placesMin: z.coerce.number().int().min(1).max(60).optional(),
    climatisation: booleenRequete.optional(),
    avecChauffeur: booleenRequete.optional(),
    prixMax: z.coerce.number().int().positive().optional(),
    noteMin: z.coerce.number().min(1).max(5).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
    tri: z.enum(["prix", "note", "distance"]).default("prix"),
  })
  .extend(pagination.shape)
  .refine(finApresDebut, { message: "validation.fin_avant_debut", path: ["fin"] });
export type RechercheParams = z.infer<typeof rechercheParams>;

export const prixParams = periode;

// ---------------------------------------------------------------------------
// Réservations
// ---------------------------------------------------------------------------

const optionsReservables = z.array(z.enum(OPTIONS_RESERVABLES)).max(10).default([]);

/** Réservation en ligne par un client (paiement sur place en Phase 1). */
export const reservationClientCreer = periodeBase
  .extend({
    vehiculeId: uuid,
    options: optionsReservables,
    livraison: z.boolean().default(false),
    pointRetraitDepartId: uuid.optional(),
    pointRetraitRetourId: uuid.optional(),
  })
  .refine(finApresDebut, { message: "validation.fin_avant_debut", path: ["fin"] });

export const reservationDatesModifier = periode;

const nouveauClient = z.object({
  telephone,
  nom: z.string().trim().min(1).max(100),
  prenom: z.string().trim().min(1).max(100),
  dateNaissance: dateCalendaire.optional(),
  permis: z
    .object({
      numero: z.string().trim().min(3).max(50),
      dateDelivrance: dateCalendaire,
      dateExpiration: dateCalendaire.optional().nullable(),
    })
    .optional(),
});

/** Réservation créée par l'agence (comptoir ou téléphone). */
export const reservationComptoirCreer = periodeBase
  .extend({
    vehiculeId: uuid,
    origine: z.enum(["comptoir", "telephone"]).default("comptoir"),
    client: z.union([z.object({ id: uuid }), nouveauClient]),
    options: optionsReservables,
    livraison: z.boolean().default(false),
    departImmediat: z.boolean().default(false),
    /** Prix négocié au comptoir (sinon prix calculé). */
    prixTotal: montant.optional(),
    remise: montant.optional(),
    noteInterne: z.string().max(1000).optional(),
  })
  .refine(finApresDebut, { message: "validation.fin_avant_debut", path: ["fin"] });

export const blocageCreer = periodeBase
  .extend({ vehiculeId: uuid, motif: z.string().trim().min(1).max(200) })
  .refine(finApresDebut, { message: "validation.fin_avant_debut", path: ["fin"] });

export const reservationRefuser = z.object({ motif: z.string().trim().min(3).max(500) });
export const reservationAnnuler = z.object({ motif: z.string().trim().max(500).optional() });
export const reservationReaffecter = z.object({ vehiculeId: uuid });
export const reservationProlonger = z.object({ fin: instant });

export const filtreReservations = pagination.extend({
  statut: z.enum(STATUTS_RESERVATION).optional(),
  debut: instant.optional(),
  fin: instant.optional(),
  recherche: z.string().trim().max(100).optional(),
});

// ---------------------------------------------------------------------------
// Contrats et états des lieux
// ---------------------------------------------------------------------------

/** Image PNG/JPEG en data URL (signature), limitée à ~500 Ko. */
export const imageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "validation.image")
  .max(700_000, "validation.image_trop_lourde");

export const dommage = z.object({
  id: z.string().min(1).max(50),
  zone: z.string().min(1).max(50),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  type: z.enum(["rayure", "bosse", "casse", "autre"]),
  description: z.string().max(300).optional(),
  photo: z.string().max(300).optional(),
});

export const etatDesLieuxCreer = z.object({
  moment: z.enum(["depart", "retour"]),
  kilometrage: z.number().int().min(0).max(2_000_000),
  carburant: z.number().int().min(0).max(8),
  dommages: z.array(dommage).max(100).default([]),
  photos: z
    .array(z.object({ cle: z.string().min(1), prisLe: z.iso.datetime({ offset: true }) }))
    .max(40)
    .default([]),
  observations: z.string().max(2000).optional(),
  signatureClient: imageDataUrl,
});

export const contratSigner = z.object({
  signatureClient: imageDataUrl,
  signatureAgence: imageDataUrl.optional(),
});

/** Retour du véhicule : frais complémentaires calculés par l'API à partir des deux états des lieux. */
export const retourVehicule = z.object({
  fraisDommages: montant.default(0),
  restitutionCaution: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Agence, flotte, tarifs
// ---------------------------------------------------------------------------

export const agenceInscrire = z.object({
  raisonSociale: z.string().trim().min(2).max(200),
  nif: z
    .string()
    .trim()
    .regex(/^\d{15,20}$/, "validation.nif"),
  registreCommerce: z.string().trim().min(5).max(50),
  agrement: z.string().trim().max(50).optional(),
  wilaya: z.number().int().min(1).max(58),
  adresse: z.string().trim().min(5).max(300),
  telephone,
  email: z.email("validation.email").optional(),
  justificatifs: z.array(z.string().min(1)).max(10).default([]),
  photos: z.array(z.string().min(1)).max(10).default([]),
});

export const agenceParametres = z.object({
  battementMinutes: z.number().int().min(0).max(1440).optional(),
  confirmationInstantanee: z.boolean().optional(),
  politiqueAnnulation: z.enum(POLITIQUES_ANNULATION).optional(),
  ageMinimum: z.number().int().min(18).max(99).optional(),
  ancienneteMinPermisAnnees: z.number().int().min(0).max(20).optional(),
  prixKmSupplementaire: montant.optional(),
  prixHuitiemeCarburant: montant.optional(),
  logoUrl: z.string().max(300).optional().nullable(),
  telephone: telephone.optional(),
  adresse: z.string().trim().min(5).max(300).optional(),
});

const horaires = z.partialRecord(
  z.enum(["sam", "dim", "lun", "mar", "mer", "jeu", "ven"]),
  z.array(z.tuple([z.string().regex(/^\d{2}:\d{2}$/), z.string().regex(/^\d{2}:\d{2}$/)])),
);

export const pointRetraitCreer = z.object({
  nom: z.string().trim().min(2).max(100),
  adresse: z.string().trim().min(3).max(300),
  wilaya: z.number().int().min(1).max(58),
  commune: z.string().trim().min(2).max(100),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  horaires: horaires.default({}),
});

const anneeCourante = new Date().getFullYear();
export const vehiculeCreer = z.object({
  pointRetraitId: uuid,
  categorie: z.enum(CATEGORIES_VEHICULE),
  marque: z.string().trim().min(1).max(50),
  modele: z.string().trim().min(1).max(50),
  annee: z
    .number()
    .int()
    .min(1990)
    .max(anneeCourante + 1),
  immatriculation: z.string().trim().toUpperCase().min(4).max(20),
  boite: z.enum(BOITES),
  carburant: z.enum(CARBURANTS),
  places: z.number().int().min(1).max(60),
  options: z
    .object({
      climatisation: z.boolean().optional(),
      siegeBebe: z.boolean().optional(),
      gps: z.boolean().optional(),
      conducteurAdditionnel: z.boolean().optional(),
      avecChauffeur: z.boolean().optional(),
    })
    .default({}),
  kilometrage: z.number().int().min(0).default(0),
  kmInclusParJour: z.number().int().positive().nullable().default(null),
  visiblePlateforme: z.boolean().default(true),
  statut: z.enum(STATUTS_VEHICULE).default("disponible"),
});
export const vehiculeModifier = vehiculeCreer.partial();

const palier = z.object({
  aPartirDeJours: z.number().int().min(2).max(365),
  prixJour: montantStrict,
});
const supplement = z
  .object({ parJour: montant.optional(), forfait: montant.optional() })
  .refine((s) => s.parJour !== undefined || s.forfait !== undefined, "validation.supplement");

export const tarifCreer = z
  .object({
    vehiculeId: uuid.optional(),
    categorie: z.enum(CATEGORIES_VEHICULE).optional(),
    libelle: z.string().trim().max(100).optional(),
    prixJour: montantStrict,
    paliers: z.array(palier).max(10).default([]),
    supplements: z
      .partialRecord(z.enum([...OPTIONS_RESERVABLES, "livraison"] as const), supplement)
      .default({}),
    saisonDebut: dateCalendaire.optional().nullable(),
    saisonFin: dateCalendaire.optional().nullable(),
    caution: montant.default(0),
    actif: z.boolean().default(true),
  })
  .refine((t) => (t.vehiculeId ? !t.categorie : !!t.categorie), {
    message: "validation.tarif_cible",
    path: ["vehiculeId"],
  })
  .refine(
    (t) => !t.saisonDebut === !t.saisonFin && (!t.saisonDebut || t.saisonFin! >= t.saisonDebut),
    {
      message: "validation.saison",
      path: ["saisonFin"],
    },
  );

export const membreAjouter = z.object({
  telephone,
  nom: z.string().trim().min(1).max(100),
  prenom: z.string().trim().min(1).max(100),
  role: z.enum(["gerant", "employe"]).default("employe"),
  permissions: z.array(z.enum(PERMISSIONS_EMPLOYE)).default([]),
});

export const clientAgenceModifier = z.object({
  notesInternes: z.string().max(5000).optional().nullable(),
  listeNoire: z.boolean().optional(),
  motifListeNoire: z.string().max(500).optional().nullable(),
});

export const paiementEnregistrer = z.object({
  type: z.enum(TYPES_PAIEMENT),
  moyen: z.enum(MOYENS_PAIEMENT),
  montant: montantStrict,
});

export const planningParams = periode;

// ---------------------------------------------------------------------------
// Entretien (4.10)
// ---------------------------------------------------------------------------

export const entretienCreer = z
  .object({
    vehiculeId: uuid,
    type: z.enum([
      "vidange",
      "assurance",
      "controle_technique",
      "vignette",
      "pneus",
      "freins",
      "revision",
      "reparation",
      "autre",
    ]),
    date: dateCalendaire,
    kilometrage: z.number().int().min(0).max(2_000_000).optional().nullable(),
    cout: montant.default(0),
    /** Laisser vide pour l'échéance proposée par défaut. */
    prochaineEcheanceDate: dateCalendaire.optional().nullable(),
    prochaineEcheanceKm: z.number().int().min(0).max(2_000_000).optional().nullable(),
    prestataire: z.string().trim().max(150).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine((e) => !e.prochaineEcheanceDate || e.prochaineEcheanceDate >= e.date, {
    message: "validation.echeance_avant_date",
    path: ["prochaineEcheanceDate"],
  });
export const entretienModifier = entretienCreer;

// ---------------------------------------------------------------------------
// Fichiers
// ---------------------------------------------------------------------------

export const TYPES_FICHIERS = [
  "photo_vehicule",
  "document_identite",
  "justificatif_agence",
  "photo_etat_des_lieux",
  "logo",
] as const;
export const demandeTeleversement = z.object({
  usage: z.enum(TYPES_FICHIERS),
  typeMime: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  taille: z.number().int().positive().max(5_000_000),
});

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export const agenceDecision = z.object({
  decision: z.enum(["valider", "suspendre", "reactiver"]),
  motif: z.string().trim().max(500).optional(),
  tauxCommissionBp: z.number().int().min(0).max(10_000).optional(),
});

export const documentDecision = z.object({ decision: z.enum(["verifie", "refuse"]) });
export const utilisateurDecision = z.object({ decision: z.enum(["bloquer", "debloquer"]) });
