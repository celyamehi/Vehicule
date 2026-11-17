-- Règles métier garanties par la base elle-même (section 6 du cahier des charges).

-- 1. updated_at mis à jour automatiquement sur toutes les tables.
CREATE OR REPLACE FUNCTION maj_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'utilisateurs', 'documents_identite', 'codes_otp', 'sessions', 'agences', 'membres_agence',
    'points_retrait', 'clients_agence', 'categories_vehicule', 'vehicules', 'photos_vehicule',
    'tarifs', 'reservations', 'contrats', 'etats_des_lieux', 'paiements', 'journal_actions',
    'notifications'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION maj_updated_at()',
      t || '_maj_updated_at', t
    );
  END LOOP;
END;
$$;--> statement-breakpoint

-- 2. Période bloquée = [debut, fin + battement) — règle 6.3.2 (battement) et section 8.
--    Calculée par trigger pour que personne (API, script, SQL direct) ne puisse l'oublier.
CREATE OR REPLACE FUNCTION calcul_periode_reservation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.periode := tstzrange(
    NEW.debut,
    NEW.fin + make_interval(mins => NEW.battement_minutes),
    '[)'
  );
  RETURN NEW;
END;
$$;--> statement-breakpoint

CREATE TRIGGER reservations_calcul_periode
  BEFORE INSERT OR UPDATE OF debut, fin, battement_minutes, periode ON reservations
  FOR EACH ROW EXECUTE FUNCTION calcul_periode_reservation();--> statement-breakpoint

-- 3. Anti-double réservation (règle 6.3.1) : un véhicule ne peut jamais avoir deux
--    réservations bloquantes dont les périodes se chevauchent, quelle que soit l'origine.
ALTER TABLE reservations
  ADD CONSTRAINT pas_de_chevauchement
  EXCLUDE USING gist (vehicule_id WITH =, periode WITH &&)
  WHERE (statut IN ('en_attente_paiement', 'en_attente_agence', 'confirmee', 'en_cours'));--> statement-breakpoint

-- 4. Un avis par réservation et autres règles viendront en Phase 2 (tables non créées, voir D7).

-- 5. Une réservation en attente doit avoir une échéance d'expiration (règle 6.3.3).
ALTER TABLE reservations
  ADD CONSTRAINT reservations_expiration_si_attente
  CHECK (statut NOT IN ('en_attente_paiement', 'en_attente_agence') OR expire_le IS NOT NULL);--> statement-breakpoint

-- 6. Recherche de disponibilité rapide sur les périodes.
CREATE INDEX reservations_periode_gix ON reservations USING gist (periode);
