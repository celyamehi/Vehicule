CREATE TYPE "public"."auteur_message" AS ENUM('client', 'agence');--> statement-breakpoint
CREATE TYPE "public"."statut_amende" AS ENUM('a_traiter', 'refacturee', 'payee', 'contestee');--> statement-breakpoint
CREATE TYPE "public"."statut_avis" AS ENUM('publie', 'masque');--> statement-breakpoint
CREATE TABLE "amendes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"vehicule_id" uuid NOT NULL,
	"reservation_id" uuid,
	"client_id" uuid,
	"date_infraction" timestamp with time zone NOT NULL,
	"montant" integer NOT NULL,
	"motif" text NOT NULL,
	"lieu" text,
	"reference" text,
	"statut" "statut_amende" DEFAULT 'a_traiter' NOT NULL,
	"notes" text,
	"cree_par" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amendes_montant_positif" CHECK ("amendes"."montant" >= 0)
);
--> statement-breakpoint
CREATE TABLE "avis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"vehicule_id" uuid,
	"auteur_id" uuid NOT NULL,
	"note" smallint NOT NULL,
	"commentaire" text,
	"reponse_agence" text,
	"repondu_le" timestamp with time zone,
	"statut" "statut_avis" DEFAULT 'publie' NOT NULL,
	"signale" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "avis_note_valide" CHECK ("avis"."note" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "factures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"montant" integer NOT NULL,
	"emise_le" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"auteur_id" uuid NOT NULL,
	"auteur" "auteur_message" NOT NULL,
	"texte" text NOT NULL,
	"lu_le" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_texte_non_vide" CHECK (length(trim("messages"."texte")) BETWEEN 1 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "agences" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "livraison" jsonb;--> statement-breakpoint
ALTER TABLE "amendes" ADD CONSTRAINT "amendes_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendes" ADD CONSTRAINT "amendes_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendes" ADD CONSTRAINT "amendes_client_id_utilisateurs_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendes" ADD CONSTRAINT "amendes_cree_par_utilisateurs_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendes" ADD CONSTRAINT "amendes_vehicule_meme_agence_fk" FOREIGN KEY ("vehicule_id","agence_id") REFERENCES "public"."vehicules"("id","agence_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_vehicule_id_vehicules_id_fk" FOREIGN KEY ("vehicule_id") REFERENCES "public"."vehicules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avis" ADD CONSTRAINT "avis_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factures" ADD CONSTRAINT "factures_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factures" ADD CONSTRAINT "factures_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amendes_agence_idx" ON "amendes" USING btree ("agence_id","date_infraction");--> statement-breakpoint
CREATE UNIQUE INDEX "avis_reservation_uq" ON "avis" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "avis_agence_idx" ON "avis" USING btree ("agence_id","statut","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "factures_reservation_uq" ON "factures" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "factures_numero_uq" ON "factures" USING btree ("agence_id","numero");--> statement-breakpoint
CREATE INDEX "messages_reservation_idx" ON "messages" USING btree ("reservation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agences_slug_uq" ON "agences" USING btree ("slug");