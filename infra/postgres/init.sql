-- Exécuté une seule fois à la création du volume PostgreSQL.
-- Les extensions sont aussi créées par les migrations (IF NOT EXISTS) ;
-- ce script prépare surtout la base de test.

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE DATABASE lvb_test;
\connect lvb_test
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
