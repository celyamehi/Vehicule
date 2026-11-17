ALTER TABLE "agences" ADD COLUMN "prix_km_supplementaire" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "agences" ADD COLUMN "prix_huitieme_carburant" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "frais_retour" jsonb;--> statement-breakpoint
ALTER TABLE "agences" ADD CONSTRAINT "agences_frais_positifs" CHECK ("agences"."prix_km_supplementaire" >= 0 AND "agences"."prix_huitieme_carburant" >= 0);