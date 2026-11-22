CREATE TABLE "entreprises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agence_id" uuid NOT NULL,
	"raison_sociale" text NOT NULL,
	"nif" text,
	"nis" text,
	"registre_commerce" text,
	"article_imposition" text,
	"adresse" text,
	"telephone" text,
	"email" text,
	"contact_nom" text,
	"delai_paiement_jours" integer DEFAULT 0 NOT NULL,
	"notes_internes" text,
	"liste_noire" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entreprises_id_agence_uq" UNIQUE("id","agence_id"),
	CONSTRAINT "entreprises_delai_valide" CHECK ("entreprises"."delai_paiement_jours" >= 0 AND "entreprises"."delai_paiement_jours" <= 365)
);
--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "entreprise_id" uuid;--> statement-breakpoint
ALTER TABLE "entreprises" ADD CONSTRAINT "entreprises_agence_id_agences_id_fk" FOREIGN KEY ("agence_id") REFERENCES "public"."agences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entreprises_agence_idx" ON "entreprises" USING btree ("agence_id","raison_sociale");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_entreprise_meme_agence_fk" FOREIGN KEY ("entreprise_id","agence_id") REFERENCES "public"."entreprises"("id","agence_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reservations_entreprise_idx" ON "reservations" USING btree ("entreprise_id");