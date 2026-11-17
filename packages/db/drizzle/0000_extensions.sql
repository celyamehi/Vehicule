-- Extensions nécessaires (section 7 et 8 du cahier des charges).
-- btree_gist : contrainte d'exclusion mêlant égalité (vehicule_id) et chevauchement (periode).
-- postgis    : positions géographiques des points de retrait (recherche par distance).
-- pgcrypto   : gen_random_uuid() et hachages côté SQL si besoin.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;
