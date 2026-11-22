CREATE TYPE "public"."categorie_depense" AS ENUM('carburant', 'pneus', 'reparation', 'entretien', 'assurance', 'lavage', 'loyer', 'salaires', 'taxes', 'publicite', 'autre');--> statement-breakpoint
CREATE TABLE "depenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"vehicule_id" uuid,
	"categorie" "categorie_depense" NOT NULL,
	"libelle" text NOT NULL,
	"montant" integer NOT NULL,
	"date" date NOT NULL,
	"moyen" "moyen_paiement",
	"notes" text,
	"cree_par" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "depenses_montant_positif" CHECK ("depenses"."montant" > 0)
);
--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_cree_par_utilisateurs_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depenses" ADD CONSTRAINT "depenses_vehicule_meme_agence_fk" FOREIGN KEY ("vehicule_id","agence_id") REFERENCES "public"."vehicules"("id","agence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "depenses_agence_idx" ON "depenses" USING btree ("agence_id","date");--> statement-breakpoint
CREATE INDEX "depenses_vehicule_idx" ON "depenses" USING btree ("vehicule_id");