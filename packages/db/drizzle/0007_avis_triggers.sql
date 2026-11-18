-- updated_at automatique sur les nouvelles tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['avis', 'messages', 'amendes', 'factures'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION maj_updated_at()', t || '_maj_updated_at', t);
  END LOOP;
END;
$$;--> statement-breakpoint

-- Identifiant d'URL des agences existantes (page publique).
UPDATE agences
SET slug = trim(both '-' from regexp_replace(lower(translate(raison_sociale,
  'àâäáãåçéèêëíìîïñóòôöõúùûüýÿÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝ',
  'aaaaaaceeeeiiiinooooouuuuyyaaaaaaceeeeiiiinooooouuuuy')), '[^a-z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 4)
WHERE slug IS NULL;
