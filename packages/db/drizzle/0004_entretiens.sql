CREATE TYPE "public"."type_entretien" AS ENUM('vidange', 'assurance', 'controle_technique', 'vignette', 'pneus', 'freins', 'revision', 'reparation', 'autre');--> statement-breakpoint
CREATE TABLE "entretiens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"vehicule_id" uuid NOT NULL,
	"type" "type_entretien" NOT NULL,
	"date" date NOT NULL,
	"kilometrage" integer,
	"cout" integer DEFAULT 0 NOT NULL,
	"prochaine_echeance_date" date,
	"prochaine_echeance_km" integer,
	"prestataire" text,
	"notes" text,
	"cree_par" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entretiens_cout_positif" CHECK ("entretiens"."cout" >= 0),
	CONSTRAINT "entretiens_km_positifs" CHECK (coalesce("entretiens"."kilometrage", 0) >= 0 AND coalesce("entretiens"."prochaine_echeance_km", 0) >= 0)
);
--> statement-breakpoint
ALTER TABLE "entretiens" ADD CONSTRAINT "entretiens_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entretiens" ADD CONSTRAINT "entretiens_cree_par_utilisateurs_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entretiens" ADD CONSTRAINT "entretiens_vehicule_meme_agence_fk" FOREIGN KEY ("vehicule_id","agence_id") REFERENCES "public"."vehicules"("id","agence_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entretiens_vehicule_idx" ON "entretiens" USING btree ("vehicule_id","type","date");--> statement-breakpoint
CREATE INDEX "entretiens_agence_idx" ON "entretiens" USING btree ("agence_id","date");