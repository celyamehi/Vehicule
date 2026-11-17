CREATE TYPE "public"."boite" AS ENUM('manuelle', 'automatique');--> statement-breakpoint
CREATE TYPE "public"."carburant" AS ENUM('essence', 'diesel', 'gpl', 'hybride', 'electrique');--> statement-breakpoint
CREATE TYPE "public"."langue" AS ENUM('fr', 'ar', 'kab', 'en');--> statement-breakpoint
CREATE TYPE "public"."moment_etat_des_lieux" AS ENUM('depart', 'retour');--> statement-breakpoint
CREATE TYPE "public"."moyen_paiement" AS ENUM('especes', 'cib', 'edahabia', 'virement', 'baridimob', 'cheque');--> statement-breakpoint
CREATE TYPE "public"."origine_reservation" AS ENUM('plateforme', 'comptoir', 'telephone', 'blocage');--> statement-breakpoint
CREATE TYPE "public"."politique_annulation" AS ENUM('souple', 'moderee', 'stricte');--> statement-breakpoint
CREATE TYPE "public"."role_membre" AS ENUM('gerant', 'employe');--> statement-breakpoint
CREATE TYPE "public"."role_plateforme" AS ENUM('utilisateur', 'admin');--> statement-breakpoint
CREATE TYPE "public"."statut_agence" AS ENUM('en_attente', 'validee', 'suspendue');--> statement-breakpoint
CREATE TYPE "public"."statut_paiement" AS ENUM('en_attente', 'reussi', 'echoue', 'annule');--> statement-breakpoint
CREATE TYPE "public"."statut_reservation" AS ENUM('en_attente_paiement', 'en_attente_agence', 'confirmee', 'en_cours', 'terminee', 'refusee', 'expiree', 'annulee_client', 'annulee_agence', 'non_presentation', 'litige');--> statement-breakpoint
CREATE TYPE "public"."statut_utilisateur" AS ENUM('actif', 'bloque', 'supprime');--> statement-breakpoint
CREATE TYPE "public"."statut_vehicule" AS ENUM('disponible', 'loue', 'en_entretien', 'hors_service');--> statement-breakpoint
CREATE TYPE "public"."statut_verification" AS ENUM('en_attente', 'verifie', 'refuse');--> statement-breakpoint
CREATE TYPE "public"."type_document" AS ENUM('permis', 'cni', 'passeport');--> statement-breakpoint
CREATE TYPE "public"."type_paiement" AS ENUM('acompte', 'solde', 'caution', 'restitution_caution', 'remboursement', 'frais');--> statement-breakpoint
CREATE TABLE "agences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raison_sociale" text NOT NULL,
	"nif" text NOT NULL,
	"registre_commerce" text NOT NULL,
	"agrement" text,
	"wilaya" smallint NOT NULL,
	"adresse" text NOT NULL,
	"telephone" text NOT NULL,
	"email" text,
	"logo_url" text,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"justificatifs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"statut" "statut_agence" DEFAULT 'en_attente' NOT NULL,
	"motif_statut" text,
	"validee_le" timestamp with time zone,
	"taux_commission_bp" integer DEFAULT 1000 NOT NULL,
	"score" integer DEFAULT 100 NOT NULL,
	"battement_minutes" integer DEFAULT 120 NOT NULL,
	"confirmation_instantanee" boolean DEFAULT false NOT NULL,
	"politique_annulation" "politique_annulation" DEFAULT 'moderee' NOT NULL,
	"age_minimum" smallint DEFAULT 21 NOT NULL,
	"anciennete_min_permis_annees" smallint DEFAULT 2 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agences_wilaya_valide" CHECK ("agences"."wilaya" BETWEEN 1 AND 58),
	CONSTRAINT "agences_battement_positif" CHECK ("agences"."battement_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "agences_commission_valide" CHECK ("agences"."taux_commission_bp" BETWEEN 0 AND 10000),
	CONSTRAINT "agences_age_minimum" CHECK ("agences"."age_minimum" BETWEEN 18 AND 99)
);
--> statement-breakpoint
CREATE TABLE "categories_vehicule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"libelles" jsonb NOT NULL,
	"ordre" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_vehicule_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "clients_agence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"notes_internes" text,
	"liste_noire" boolean DEFAULT false NOT NULL,
	"motif_liste_noire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "codes_otp" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telephone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"essais" smallint DEFAULT 0 NOT NULL,
	"utilise_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contrats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"pdf_url" text,
	"empreinte_pdf" text,
	"signe_le" timestamp with time zone,
	"signature_client" jsonb,
	"signature_agence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_identite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"type" "type_document" NOT NULL,
	"numero" text,
	"date_delivrance" date,
	"date_expiration" date,
	"fichiers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"statut_verification" "statut_verification" DEFAULT 'en_attente' NOT NULL,
	"verifie_par" uuid,
	"verifie_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "etats_des_lieux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"moment" "moment_etat_des_lieux" NOT NULL,
	"kilometrage" integer NOT NULL,
	"carburant" smallint NOT NULL,
	"dommages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"observations" text,
	"signe_par" uuid,
	"signature_client" jsonb,
	"signe_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "etats_des_lieux_carburant" CHECK ("etats_des_lieux"."carburant" BETWEEN 0 AND 8),
	CONSTRAINT "etats_des_lieux_km" CHECK ("etats_des_lieux"."kilometrage" >= 0)
);
--> statement-breakpoint
CREATE TABLE "journal_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid,
	"utilisateur_id" uuid,
	"action" text NOT NULL,
	"entite" text NOT NULL,
	"entite_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membres_agence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"role" "role_membre" NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"type" text NOT NULL,
	"donnees" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"canal" text DEFAULT 'app' NOT NULL,
	"lue_le" timestamp with time zone,
	"envoyee_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paiements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"type" "type_paiement" NOT NULL,
	"moyen" "moyen_paiement" NOT NULL,
	"montant" integer NOT NULL,
	"statut" "statut_paiement" DEFAULT 'en_attente' NOT NULL,
	"reference_externe" text,
	"enregistre_par" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paiements_montant_positif" CHECK ("paiements"."montant" > 0)
);
--> statement-breakpoint
CREATE TABLE "photos_vehicule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicule_id" uuid NOT NULL,
	"url" text NOT NULL,
	"ordre" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_retrait" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"adresse" text NOT NULL,
	"wilaya" smallint NOT NULL,
	"commune" text NOT NULL,
	"position" geography(Point, 4326),
	"horaires" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_retrait_id_agence_uq" UNIQUE("id","agence_id"),
	CONSTRAINT "points_retrait_wilaya_valide" CHECK ("points_retrait"."wilaya" BETWEEN 1 AND 58)
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"agence_id" uuid NOT NULL,
	"vehicule_id" uuid NOT NULL,
	"client_id" uuid,
	"point_retrait_depart_id" uuid,
	"point_retrait_retour_id" uuid,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone NOT NULL,
	"battement_minutes" integer DEFAULT 120 NOT NULL,
	"periode" tstzrange DEFAULT 'empty'::tstzrange NOT NULL,
	"origine" "origine_reservation" NOT NULL,
	"statut" "statut_reservation" NOT NULL,
	"prix_total" integer DEFAULT 0 NOT NULL,
	"detail_prix" jsonb,
	"politique_annulation" "politique_annulation" NOT NULL,
	"caution" integer DEFAULT 0 NOT NULL,
	"conditions" jsonb,
	"options_choisies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expire_le" timestamp with time zone,
	"motif_refus" text,
	"motif_blocage" text,
	"note_interne" text,
	"cree_par" uuid,
	"confirmee_le" timestamp with time zone,
	"depart_le" timestamp with time zone,
	"retour_le" timestamp with time zone,
	"annulee_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reservations_dates_coherentes" CHECK ("reservations"."fin" > "reservations"."debut"),
	CONSTRAINT "reservations_battement_valide" CHECK ("reservations"."battement_minutes" BETWEEN 0 AND 1440),
	CONSTRAINT "reservations_montants_positifs" CHECK ("reservations"."prix_total" >= 0 AND "reservations"."caution" >= 0),
	CONSTRAINT "reservations_client_obligatoire" CHECK (("reservations"."origine" = 'blocage') OR ("reservations"."client_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"jeton_hash" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"revoque_le" timestamp with time zone,
	"appareil" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarifs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"vehicule_id" uuid,
	"categorie_id" uuid,
	"libelle" text,
	"prix_jour" integer NOT NULL,
	"paliers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"supplements" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"saison_debut" date,
	"saison_fin" date,
	"caution" integer DEFAULT 0 NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tarifs_cible_unique" CHECK (("tarifs"."vehicule_id" IS NULL) <> ("tarifs"."categorie_id" IS NULL)),
	CONSTRAINT "tarifs_prix_positif" CHECK ("tarifs"."prix_jour" > 0 AND "tarifs"."caution" >= 0),
	CONSTRAINT "tarifs_saison_coherente" CHECK (("tarifs"."saison_debut" IS NULL AND "tarifs"."saison_fin" IS NULL) OR ("tarifs"."saison_debut" IS NOT NULL AND "tarifs"."saison_fin" IS NOT NULL AND "tarifs"."saison_fin" >= "tarifs"."saison_debut"))
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telephone" text NOT NULL,
	"email" text,
	"nom" text,
	"prenom" text,
	"date_naissance" date,
	"langue" "langue" DEFAULT 'fr' NOT NULL,
	"statut" "statut_utilisateur" DEFAULT 'actif' NOT NULL,
	"role_plateforme" "role_plateforme" DEFAULT 'utilisateur' NOT NULL,
	"consentement_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilisateurs_telephone_format" CHECK ("utilisateurs"."telephone" ~ '^\+[0-9]{8,15}$')
);
--> statement-breakpoint
CREATE TABLE "vehicules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"point_retrait_id" uuid NOT NULL,
	"categorie_id" uuid NOT NULL,
	"marque" text NOT NULL,
	"modele" text NOT NULL,
	"annee" smallint NOT NULL,
	"immatriculation" text NOT NULL,
	"boite" "boite" NOT NULL,
	"carburant" "carburant" NOT NULL,
	"places" smallint NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"kilometrage" integer DEFAULT 0 NOT NULL,
	"km_inclus_par_jour" integer,
	"statut" "statut_vehicule" DEFAULT 'disponible' NOT NULL,
	"visible_plateforme" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicules_id_agence_uq" UNIQUE("id","agence_id"),
	CONSTRAINT "vehicules_annee_valide" CHECK ("vehicules"."annee" BETWEEN 1990 AND 2100),
	CONSTRAINT "vehicules_places_valide" CHECK ("vehicules"."places" BETWEEN 1 AND 60),
	CONSTRAINT "vehicules_kilometrage_positif" CHECK ("vehicules"."kilometrage" >= 0)
);
--> statement-breakpoint
ALTER TABLE "clients_agence" ADD CONSTRAINT "clients_agence_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients_agence" ADD CONSTRAINT "clients_agence_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrats" ADD CONSTRAINT "contrats_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contrats" ADD CONSTRAINT "contrats_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_identite" ADD CONSTRAINT "documents_identite_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_identite" ADD CONSTRAINT "documents_identite_verifie_par_utilisateurs_id_fk" FOREIGN KEY ("verifie_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etats_des_lieux" ADD CONSTRAINT "etats_des_lieux_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etats_des_lieux" ADD CONSTRAINT "etats_des_lieux_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "etats_des_lieux" ADD CONSTRAINT "etats_des_lieux_signe_par_utilisateurs_id_fk" FOREIGN KEY ("signe_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_actions" ADD CONSTRAINT "journal_actions_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_actions" ADD CONSTRAINT "journal_actions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membres_agence" ADD CONSTRAINT "membres_agence_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membres_agence" ADD CONSTRAINT "membres_agence_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_enregistre_par_utilisateurs_id_fk" FOREIGN KEY ("enregistre_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos_vehicule" ADD CONSTRAINT "photos_vehicule_vehicule_id_vehicules_id_fk" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_retrait" ADD CONSTRAINT "points_retrait_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_client_id_utilisateurs_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_cree_par_utilisateurs_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_vehicule_meme_agence_fk" FOREIGN KEY ("vehicule_id","agence_id") REFERENCES "public"."vehicules"("id","agence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_point_depart_meme_agence_fk" FOREIGN KEY ("point_retrait_depart_id","agence_id") REFERENCES "public"."points_retrait"("id","agence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_point_retour_meme_agence_fk" FOREIGN KEY ("point_retrait_retour_id","agence_id") REFERENCES "public"."points_retrait"("id","agence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifs" ADD CONSTRAINT "tarifs_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifs" ADD CONSTRAINT "tarifs_vehicule_id_vehicules_id_fk" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifs" ADD CONSTRAINT "tarifs_categorie_id_categories_vehicule_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_vehicule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicules" ADD CONSTRAINT "vehicules_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicules" ADD CONSTRAINT "vehicules_categorie_id_categories_vehicule_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_vehicule"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicules" ADD CONSTRAINT "vehicules_point_retrait_meme_agence_fk" FOREIGN KEY ("point_retrait_id","agence_id") REFERENCES "public"."points_retrait"("id","agence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agences_nif_uq" ON "agences" USING btree ("nif");--> statement-breakpoint
CREATE INDEX "agences_statut_wilaya_idx" ON "agences" USING btree ("statut","wilaya");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_agence_uq" ON "clients_agence" USING btree ("agence_id","utilisateur_id");--> statement-breakpoint
CREATE INDEX "codes_otp_telephone_idx" ON "codes_otp" USING btree ("telephone","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contrats_reservation_uq" ON "contrats" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contrats_numero_uq" ON "contrats" USING btree ("agence_id","numero");--> statement-breakpoint
CREATE INDEX "documents_identite_utilisateur_idx" ON "documents_identite" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "etats_des_lieux_uq" ON "etats_des_lieux" USING btree ("reservation_id","moment");--> statement-breakpoint
CREATE INDEX "journal_actions_agence_idx" ON "journal_actions" USING btree ("agence_id","created_at");--> statement-breakpoint
CREATE INDEX "journal_actions_entite_idx" ON "journal_actions" USING btree ("entite","entite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "membres_agence_uq" ON "membres_agence" USING btree ("agence_id","utilisateur_id");--> statement-breakpoint
CREATE INDEX "notifications_utilisateur_idx" ON "notifications" USING btree ("utilisateur_id","created_at");--> statement-breakpoint
CREATE INDEX "paiements_reservation_idx" ON "paiements" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "paiements_reference_externe_uq" ON "paiements" USING btree ("reference_externe");--> statement-breakpoint
CREATE INDEX "photos_vehicule_vehicule_idx" ON "photos_vehicule" USING btree ("vehicule_id","ordre");--> statement-breakpoint
CREATE INDEX "points_retrait_agence_idx" ON "points_retrait" USING btree ("agence_id");--> statement-breakpoint
CREATE INDEX "points_retrait_wilaya_commune_idx" ON "points_retrait" USING btree ("wilaya","commune");--> statement-breakpoint
CREATE INDEX "points_retrait_position_gix" ON "points_retrait" USING gist ("position");--> statement-breakpoint
CREATE UNIQUE INDEX "reservations_code_uq" ON "reservations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "reservations_agence_debut_idx" ON "reservations" USING btree ("agence_id","debut");--> statement-breakpoint
CREATE INDEX "reservations_client_idx" ON "reservations" USING btree ("client_id","debut");--> statement-breakpoint
CREATE INDEX "reservations_expiration_idx" ON "reservations" USING btree ("expire_le") WHERE "reservations"."statut" IN ('en_attente_paiement', 'en_attente_agence');--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_jeton_uq" ON "sessions" USING btree ("jeton_hash");--> statement-breakpoint
CREATE INDEX "tarifs_agence_idx" ON "tarifs" USING btree ("agence_id");--> statement-breakpoint
CREATE INDEX "tarifs_vehicule_idx" ON "tarifs" USING btree ("vehicule_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utilisateurs_telephone_uq" ON "utilisateurs" USING btree ("telephone");--> statement-breakpoint
CREATE UNIQUE INDEX "utilisateurs_email_uq" ON "utilisateurs" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "vehicules_immatriculation_uq" ON "vehicules" USING btree ("agence_id","immatriculation");--> statement-breakpoint
CREATE INDEX "vehicules_recherche_idx" ON "vehicules" USING btree ("categorie_id","statut","visible_plateforme");